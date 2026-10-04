const STORAGE_KEY = 'blundayStats';

// Lifetime counters that span runs, for achievements
function loadStats() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return JSON.parse(stored) || {};
    } catch (_) {}
    return {};
}

export function getStat(name) {
    return loadStats()[name] || 0;
}

// Adds to a counter and returns the new total
export function incrementStat(name, amount = 1) {
    const stats = loadStats();
    stats[name] = (stats[name] || 0) + amount;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) {}
    return stats[name];
}
