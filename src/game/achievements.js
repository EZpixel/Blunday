const STORAGE_KEY = 'blundayAchievements';

// Each one's badge art is named after its title (iconName, badgeArt.js).
// Listed easiest first, the order of the Achievements screen and of Play
// Games (scripts/build-play-achievements.mjs). Progress is saved by id, so
// reordering is safe.
export const ACHIEVEMENTS = Object.freeze([
    { id: 'jetpack',      title: 'Thrust Issues',                   description: 'Collect a jetpack.' },
    { id: 'boots',        title: 'What are thoooose!',              description: 'Collect a pair of spring boots.' },
    { id: 'star',         title: 'What is this shiny thing?',       description: 'Collect a star.' },
    { id: 'gold_bag',     title: 'Bag Secured, No Cap',             description: 'Snag a gold bag.' },
    { id: 'gold_bar',     title: 'Raising the Bar',                 description: 'Snag a gold bar.' },
    { id: 'red_gem',      title: 'Gem of My Eye',                   description: 'Snag a shiny red gem.' },
    { id: 'score_10000',  title: 'Ten Thousand Reasons to Brag',    description: 'Reach a score of 10,000.' },
    { id: 'score_30000',  title: 'Thirty-K and Thriving',           description: 'Reach a score of 30,000.' },
    { id: 'score_100000', title: 'Six Figures, Baby',               description: 'Reach a score of 100,000.' },
    { id: 'no_power_10000', title: 'Look Ma, No Power-Ups!',        description: 'Reach a score of 10,000 without any power-ups.' },
    { id: 'no_gold_10000', title: 'Got Any Spare Change?',          description: 'Reach a score of 10,000 without collecting any gold.' },
    { id: 'star_1000',    title: 'A Star is Born',                  description: 'Collect 1,000 stars.' },
    { id: 'wood_1000',    title: 'Wood You Please Stop?',           description: 'Break 1,000 wooden platforms. The termites are taking notes.' },
    { id: 'jetpack_save', title: 'Emergency Exit Rocket',           description: 'Get saved from certain doom by an emergency jetpack.' },
    { id: 'liftoff',      title: 'Houston, We Have a Blunday',      description: 'Blast off on twin boosters straight to 10,000.' },
    { id: 'all_maxed',    title: 'Maxed Out and Loving It',         description: 'Fully upgrade every single upgrade.' },
    { id: 'gold_100000',  title: 'I Can Fall Now',                  description: 'Have 100,000 gold in your wallet. You\'re rich, fall in peace.' },
]);

// File name (no extension) of an achievement's or upgrade's icon: its title with
// spaces as underscores and punctuation dropped, e.g. "Look Ma, No Power-Ups!"
// → "Look_Ma_No_Power-Ups". Used by the icon build script and the game.
export function iconName(def) {
    return def.title.replace(/[^A-Za-z0-9 -]/g, '').trim().replace(/ +/g, '_');
}

export function loadUnlocked() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return JSON.parse(stored) || {};
    } catch (_) {}
    return {};
}

export function saveUnlocked(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (_) {}
}

export function isUnlocked(id) {
    return !!loadUnlocked()[id];
}

// Notified with each newly unlocked achievement's definition, wherever it was
// unlocked from (a run, the Upgrades screen). The notification, and its sound,
// is up to the listener.
const unlockSubscribers = new Set();

export function subscribeUnlocks(fn) {
    unlockSubscribers.add(fn);
    return () => unlockSubscribers.delete(fn);
}

export function unlock(id) {
    const map = loadUnlocked();
    if (map[id]) return null;
    map[id] = true;
    saveUnlocked(map);
    const def = ACHIEVEMENTS.find(a => a.id === id) || null;
    if (def) for (const fn of unlockSubscribers) fn(def);
    return def;
}

export function getAll() {
    const map = loadUnlocked();
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!map[a.id] }));
}
