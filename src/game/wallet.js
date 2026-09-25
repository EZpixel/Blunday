const STORAGE_KEY = 'blundayGold';

function loadWallet() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return parseInt(stored, 10) || 0;
    } catch (_) {}
    return 0;
}

function saveWallet(n) {
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
}

export function getGold() {
    return loadWallet();
}

export function addGold(amount) {
    const current = loadWallet();
    const next = current + amount;
    saveWallet(next);
    return next;
}

export function spendGold(amount) {
    const current = loadWallet();
    if (current < amount) return false;
    saveWallet(current - amount);
    return true;
}
