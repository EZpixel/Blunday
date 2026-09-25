import { spendGold } from './wallet.js';

const STORAGE_KEY = 'blundayUpgrades';

export const UPGRADES = Object.freeze([
    {
        id:            'moveSpeed',
        icon:          '👟',
        title:         'Nimble Feet',
        description:   'Move left/right faster.',
        maxTier:       5,
        costs:         [50, 100, 200, 400, 800],
        effectPerTier: 0.05,
    },
    {
        id:            'higherJump',
        icon:          '🦵',
        title:         'Springy Spaghetti Legs',
        description:   '+5% bounce height per tier.',
        maxTier:       5,
        costs:         [50, 100, 200, 400, 800],
        effectPerTier: 0.05,
    },
    {
        id:            'jetpackFuel',
        icon:          '⛽',
        title:         'Extra Thicc Fuel Tank',
        description:   'Jetpack fuel lasts longer — triples at max tier.',
        maxTier:       5,
        costs:         [100, 200, 500, 1000, 5000],
        effectPerTier: 0.4,
    },
    {
        id:            'umbrella',
        icon:          '🌂',
        title:         'Mary Poppins Mode',
        description:   'Umbrella slows your fall more — up to 75% at max tier.',
        maxTier:       5,
        costs:         [100, 200, 500, 1000, 5000],
        effectPerTier: 0.10,
    },
    {
        id:            'luck',
        icon:          '🍀',
        title:         'Four-Leaf Cloverdose',
        description:   'Gold pickups spawn more often.',
        maxTier:       5,
        costs:         [100, 200, 500, 1000, 5000],
        effectPerTier: 0.05,
    },
    {
        id:            'powerUpFreq',
        icon:          '🎁',
        title:         'Aura Farming',
        description:   'Jetpacks, boots, stars, and umbrellas spawn more often.',
        maxTier:       3,
        costs:         [150, 300, 600],
        effectPerTier: 0.25,
    },
    {
        id:            'starPower',
        icon:          '⭐',
        title:         'Midas Stardust',
        description:   'Stars multiply gold you grab while shining — up to 10x.',
        maxTier:       5,
        costs:         [500, 1000, 5000, 10000, 50000],
        effectPerTier: 1.6,
    },
    {
        id:            'breakableGrip',
        icon:          '🐾',
        title:         'Sticky Toe Beans',
        description:   'Breakable platforms survive extra landings.',
        maxTier:       2,
        costs:         [1000, 2000],
        effectPerTier: 1,
    },
    {
        id:            'backupJetpack',
        icon:          '🚀',
        title:         'Ctrl+Z Jetpack',
        description:   'Undo one deadly fall per run with an emergency backup jetpack.',
        maxTier:       1,
        costs:         [1000],
        effectPerTier: 1,
    },
    {
        id:            'boosterLiftOff',
        icon:          '🔥',
        title:         'Booster Ignition & Lift Off',
        description:   'Every run starts strapped to twin rockets that blast you straight to 10,000. Houston, we have a Blunday.',
        maxTier:       1,
        costs:         [100000],
        effectPerTier: 1,
    },
]);

function loadTiers() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return JSON.parse(stored) || {};
    } catch (_) {}
    return {};
}

function saveTiers(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (_) {}
}

export function getTier(id) {
    return loadTiers()[id] || 0;
}

export function getNextCost(id) {
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return null;
    const tier = getTier(id);
    if (tier >= def.maxTier) return null;
    return def.costs[tier];
}

export function purchase(id) {
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return false;
    if (getTier(id) >= def.maxTier) return false;
    const cost = getNextCost(id);
    if (cost === null) return false;
    if (!spendGold(cost)) return false;
    const tiers = loadTiers();
    tiers[id] = (tiers[id] || 0) + 1;
    saveTiers(tiers);
    return true;
}

export function getMoveSpeedMultiplier() {
    return 1 + 0.05 * getTier('moveSpeed');
}

export function getPowerUpFreqMultiplier() {
    return 1 + 0.25 * getTier('powerUpFreq');
}

export function getJetpackFuelMultiplier() {
    return 1 + 0.4 * getTier('jetpackFuel');
}

export function getHigherJumpMultiplier() {
    return 1 + 0.05 * getTier('higherJump');
}

export function getBreakableGripLevel() {
    return getTier('breakableGrip');
}

export function hasBackupJetpack() {
    return getTier('backupJetpack') > 0;
}

export function hasBoosterLiftOff() {
    return getTier('boosterLiftOff') > 0;
}

export function getLuckCoinBonus() {
    return 0.05 * getTier('luck');
}

export function getStarGoldMultiplier() {
    return 2 + 1.6 * getTier('starPower');
}

export function getUmbrellaFallReduction() {
    return 0.25 + 0.10 * getTier('umbrella');
}

export function areAllUpgradesMaxed() {
    return UPGRADES.every(u => getTier(u.id) >= u.maxTier);
}

export function getUpgradeDisplay(id) {
    const def = UPGRADES.find(u => u.id === id);
    const tier = getTier(id);
    return {
        tier,
        max:     def ? def.maxTier : 0,
        isMaxed: def ? tier >= def.maxTier : true,
    };
}
