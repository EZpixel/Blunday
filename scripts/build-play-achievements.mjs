// Builds the Play Console achievement import zip (dev only:
// `npm run play:achievements`), following
// https://developer.android.com/games/pgs/integrate-achievements#zip-file
//
//   resources/achievements/play-achievements.zip
//     AchievementsMetadata.csv       Name,Description,Incremental,Steps,Initial State,Points,List Order
//     AchievementsIconsMappings.csv  Name,icon filename
//     <name>.png                     the 512x512 icons from resources/achievements/play
//
// Every achievement is standard (not incremental) and revealed, in the order of
// src/game/achievements.js, so Play lists them the same way the game does. No
// AchievementsLocalizations.csv: it's optional and only for locales other than
// the default, and the game is English only.
//
// Play's CSVs have no header row, no quoting, and Name and Description can't
// contain commas. So in the zip only, thousands separators are dropped
// ("10,000" → "10000") and other commas become " - " ("Bag Secured, No Cap" →
// "Bag Secured - No Cap"). The game's own text keeps its commas, and they can
// be put back in Play Console's achievement editor after the import.
//
// Run `npm run icons` first if the art changed.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';
import { ACHIEVEMENTS, iconName } from '../src/game/achievements.js';

// Play points by difficulty. Each a multiple of 5 from 5 to 200; the game may
// total at most 1000, so this leaves room for achievements added later.
const POINTS = {
    jetpack: 5,
    boots: 5,
    star: 5,
    gold_bag: 5,
    gold_bar: 5,
    red_gem: 10,
    score_10000: 5,
    score_30000: 10,
    score_100000: 20,
    wood_1000: 40,
    star_1000: 40,
    no_gold_10000: 40,
    no_power_10000: 30,
    all_maxed: 80,
    jetpack_save: 40,
    liftoff: 40,
    gold_100000: 100,
};
const MAX_TOTAL_POINTS = 1000;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = join(root, 'resources/achievements/play');
const outPath = join(root, 'resources/achievements/play-achievements.zip');

function fail(msg) {
    console.error(msg);
    process.exit(1);
}

function playText(text) {
    return text.replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/\s*,\s*/g, ' - ').trim();
}

// ── Check everything Play will check ────────────────────────────────────────
const rows = ACHIEVEMENTS.map((a, i) => ({
    id: a.id,
    name: playText(a.title),
    description: playText(a.description),
    points: POINTS[a.id],
    order: i + 1,
    icon: `${iconName(a)}.png`,
}));

for (const r of rows) {
    if (r.points === undefined) fail(`No Play points for "${r.id}" (add it to POINTS)`);
    if (r.points % 5 || r.points < 5 || r.points > 200) fail(`Points for "${r.id}" must be a multiple of 5 from 5 to 200`);
    if (r.name.length > 100) fail(`Name too long (max 100): ${r.name}`);
    if (r.description.length > 500) fail(`Description too long (max 500): ${r.description}`);
    for (const text of [r.name, r.description]) if (/[,\r\n"]/.test(text)) fail(`Can't go in Play's CSV: ${text}`);
    const iconPath = join(iconDir, r.icon);
    if (!existsSync(iconPath)) fail(`Missing icon ${iconPath} (run npm run icons)`);
    if (statSync(iconPath).size >= 1024 * 1024) fail(`${r.icon} is over Play's 1 MB per file`);
}
const orphanPoints = Object.keys(POINTS).filter(id => !rows.some(r => r.id === id));
if (orphanPoints.length) fail(`Points for unknown achievements: ${orphanPoints.join(', ')}`);
const names = rows.map(r => r.name);
if (new Set(names).size !== names.length) fail('Achievement names must be unique');
const total = rows.reduce((sum, r) => sum + r.points, 0);
if (total > MAX_TOTAL_POINTS) fail(`Points total ${total}, over Play's ${MAX_TOTAL_POINTS}`);

// ── CSVs: no header row, seven / two values per row ─────────────────────────
const csv = lines => lines.map(cells => cells.join(',')).join('\r\n') + '\r\n';
const metadata = csv(rows.map(r => [r.name, r.description, 'False', '', 'Revealed', r.points, r.order]));
const mappings = csv(rows.map(r => [r.name, r.icon]));

// ── A minimal zip writer (deflate, flat, no subdirectories) ─────────────────
function zip(files) {
    const local = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of files) {
        const nameBuf = Buffer.from(name, 'utf8');
        const packed = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);              // version needed
        header.writeUInt16LE(0x0800, 6);          // UTF-8 names
        header.writeUInt16LE(8, 8);               // deflate
        header.writeUInt16LE(0, 10);              // time
        header.writeUInt16LE(0x21, 12);           // date: 1980-01-01, so builds are reproducible
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(packed.length, 18);
        header.writeUInt32LE(data.length, 22);
        header.writeUInt16LE(nameBuf.length, 26);
        header.writeUInt16LE(0, 28);
        local.push(header, nameBuf, packed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE(20, 4);               // version made by
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(0x0800, 8);
        entry.writeUInt16LE(8, 10);
        entry.writeUInt16LE(0, 12);
        entry.writeUInt16LE(0x21, 14);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(packed.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBuf.length, 28);
        entry.writeUInt32LE(offset, 42);          // the rest (extra, comment, disk, attrs) stays 0
        central.push(entry, nameBuf);
        offset += header.length + nameBuf.length + packed.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, centralBuf, end]);
}

const files = [
    { name: 'AchievementsMetadata.csv', data: Buffer.from(metadata, 'utf8') },
    { name: 'AchievementsIconsMappings.csv', data: Buffer.from(mappings, 'utf8') },
    ...rows.map(r => ({ name: r.icon, data: readFileSync(join(iconDir, r.icon)) })),
];
writeFileSync(outPath, zip(files));

for (const r of rows) console.log(`${String(r.order).padStart(2)}. ${r.name.padEnd(30)} ${String(r.points).padStart(3)} pts  ${r.icon}`);
console.log(`\n${rows.length} achievements, ${total} / ${MAX_TOTAL_POINTS} points, ${files.length} files → ${outPath}`);
