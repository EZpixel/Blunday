import { ACHIEVEMENTS, iconName } from './achievements.js';
import { UPGRADES } from './upgrades.js';

// Illustrated badges for achievements and upgrades, named after their title
// (iconName). The bundled 192px PNGs are rendered from resources/achievements
// and resources/upgrades by `npm run icons`, which refuses to run while an
// achievement or upgrade has no SVG. Separate from the power-up glyphs
// (PowerUpIcon), which the HUD keeps using.
const ACHIEVEMENT_ART = import.meta.glob('../assets/achievements/*.png', { eager: true, import: 'default' });
const UPGRADE_ART = import.meta.glob('../assets/upgrades/*.png', { eager: true, import: 'default' });

function lookup(art, dir, list, id) {
    const def = list.find(item => item.id === id);
    return (def && art[`../assets/${dir}/${iconName(def)}.png`]) || null;
}

export function achievementArt(id) {
    return lookup(ACHIEVEMENT_ART, 'achievements', ACHIEVEMENTS, id);
}

export function upgradeArt(id) {
    return lookup(UPGRADE_ART, 'upgrades', UPGRADES, id);
}

// Fetches and decodes every badge ahead of time, so the Achievements and
// Upgrades screens and the unlock toast show them instantly instead of popping
// in. Runs once the game is idle, and keeps the images referenced so the
// browser holds on to the decoded copies.
const preloaded = [];

export function preloadBadgeArt() {
    if (preloaded.length) return;
    const run = () => {
        for (const src of [...Object.values(ACHIEVEMENT_ART), ...Object.values(UPGRADE_ART)]) {
            const img = new Image();
            img.decoding = 'async';
            img.src = src;
            img.decode?.().catch(() => {}); // a failed preload just loads on demand
            preloaded.push(img);
        }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 500);
}

if (import.meta.env.DEV) {
    const missing = [
        ...ACHIEVEMENTS.filter(a => !achievementArt(a.id)),
        ...UPGRADES.filter(u => !upgradeArt(u.id)),
    ].map(item => item.title);
    if (missing.length) console.error(`No badge art for: ${missing.join(', ')}. Add its SVG under resources/ and run npm run icons.`);
}
