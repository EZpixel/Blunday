// Renders the achievement and upgrade icons from their SVG sources (dev only:
// `npm run icons`). Files are named after the in-game title (iconName() in
// src/game/achievements.js), e.g. Thrust_Issues.svg.
//
//   resources/achievements/<name>.svg        achievement artwork, one per achievement
//   resources/achievements/png/<name>.png    1024x1024 master export
//   resources/achievements/play/<name>.png   512x512, for Play Console (its
//                                            required achievement icon size)
//   src/assets/achievements/<name>.png       192x192, bundled into the game
//
//   resources/upgrades/<name>.svg            upgrade artwork, one per upgrade
//   src/assets/upgrades/<name>.png           192x192, bundled into the game
//
// In-game exports are cropped to the badge ring (the game shows them round).
// The game shows a badge at 40-48 CSS px and the UI scales up with the screen
// (--ui-scale), so 192px keeps it sharp up to 4 device px per CSS px.
//
// Fails if an achievement or upgrade has no SVG, or an SVG belongs to none, so
// the sets can't quietly drift out of sync. Old exports are cleared first, so
// a renamed item leaves nothing behind.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { ACHIEVEMENTS, iconName } from '../src/game/achievements.js';
import { UPGRADES } from '../src/game/upgrades.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The badge's ink ring (r 214 around 256, 256) plus a hair
const GAME = { size: 192, viewBox: '40 40 432 432' };

const SETS = [
    {
        label: 'achievement',
        items: ACHIEVEMENTS,
        src: join(root, 'resources/achievements'),
        outputs: [
            { dir: join(root, 'resources/achievements/png'), size: 1024 },
            { dir: join(root, 'resources/achievements/play'), size: 512, maxBytes: 1024 * 1024 },
            { dir: join(root, 'src/assets/achievements'), ...GAME },
        ],
    },
    {
        label: 'upgrade',
        items: UPGRADES,
        src: join(root, 'resources/upgrades'),
        outputs: [{ dir: join(root, 'src/assets/upgrades'), ...GAME }],
    },
];

function render(svg, size) {
    return new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: '#000000' }).render().asPng();
}

function fail(msg) {
    console.error(msg);
    process.exit(1);
}

let total = 0;
for (const { label, items, src, outputs } of SETS) {
    const names = items.map(iconName);
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    if (dupes.length) fail(`Two ${label}s share an icon name: ${dupes.join(', ')}`);
    const svgs = readdirSync(src).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4));
    const missing = names.filter(name => !svgs.includes(name));
    const orphans = svgs.filter(name => !names.includes(name));
    if (missing.length) fail(`No ${label} icon for: ${missing.join(', ')} (add ${src}/<name>.svg)`);
    if (orphans.length) fail(`${label} icons with no ${label}: ${orphans.join(', ')}`);

    for (const { dir } of outputs) {
        mkdirSync(dir, { recursive: true });
        for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(join(dir, f));
    }

    for (const name of names) {
        const svg = readFileSync(join(src, `${name}.svg`), 'utf8');
        const sizes = [];
        for (const { dir, size, viewBox, maxBytes } of outputs) {
            const source = viewBox ? svg.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`) : svg;
            const path = join(dir, `${name}.png`);
            writeFileSync(path, render(source, size));
            const bytes = statSync(path).size;
            if (maxBytes && bytes > maxBytes) fail(`${path} is ${bytes} bytes, over the ${maxBytes / 1024} KB limit`);
            sizes.push(`${size}px ${(bytes / 1024).toFixed(0).padStart(4)} KB`);
        }
        console.log(`${name.padEnd(30)} ${sizes.join('  ')}`);
    }
    total += names.length;
}
console.log(`Rendered ${total} icons.`);
