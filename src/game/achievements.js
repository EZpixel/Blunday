import { playSfx } from './audio.js';

const STORAGE_KEY = 'blundayAchievements';

export const ACHIEVEMENTS = Object.freeze([
    { id: 'jetpack',      title: 'Thrust Issues',                   description: 'Collect a jetpack.',                                    icon: 'jetpack' },
    { id: 'boots',        title: 'What are thoooose!',              description: 'Collect a pair of spring boots.',                       icon: 'boots'   },
    { id: 'star',         title: 'What is this shiny thing?',       description: 'Collect a star.',                                       icon: 'star'    },
    { id: 'gold_bag',     title: 'Bag Secured, No Cap',             description: 'Snag a gold bag.',                                      icon: 'bag'     },
    { id: 'gold_bar',     title: 'Raising the Bar',                 description: 'Snag a gold bar.',                                      icon: 'bar'     },
    { id: 'red_gem',      title: 'Gem of My Eye',                   description: 'Snag a shiny red gem.',                                 icon: 'gem'     },
    { id: 'score_10000',  title: 'Ten Thousand Reasons to Brag',    description: 'Reach a score of 10,000.',                              icon: 'score'   },
    { id: 'score_30000',  title: 'Thirty-K and Thriving',           description: 'Reach a score of 30,000.',                              icon: 'score'   },
    { id: 'score_100000', title: 'Six Figures, Baby',               description: 'Reach a score of 100,000.',                            icon: 'score'   },
    { id: 'all_maxed',    title: 'Maxed Out and Loving It',         description: 'Fully upgrade every single upgrade.',                   icon: 'crown'   },
    { id: 'jetpack_save', title: 'Emergency Exit Rocket',           description: 'Get saved from certain doom by an emergency jetpack.',  icon: 'jetpack' },
    { id: 'gold_100000',  title: 'I Can Fall Now',                  description: 'Collect 100,000 gold in total. You\'re rich, fall in peace.', icon: 'bag' },
]);

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

export function unlock(id) {
    const map = loadUnlocked();
    if (map[id]) return null;
    map[id] = true;
    saveUnlocked(map);
    playSfx('achievement');
    return ACHIEVEMENTS.find(a => a.id === id) || null;
}

export function getAll() {
    const map = loadUnlocked();
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!map[a.id] }));
}
