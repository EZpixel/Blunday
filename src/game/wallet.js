const STORAGE_KEY = 'blundayGold';
// Lifetime gold collected (never decreases when spending), for achievements
const EARNED_KEY = 'blundayGoldEarned';

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

export function getTotalEarned() {
    try {
        const stored = localStorage.getItem(EARNED_KEY);
        // Saves from before this counter existed: count the current balance as earned
        if (stored === null) return loadWallet();
        return parseInt(stored, 10) || 0;
    } catch (_) {}
    return 0;
}

export function addGold(amount) {
    const earned = getTotalEarned(); // read before saving: it may fall back to the balance
    const current = loadWallet();
    const next = current + amount;
    saveWallet(next);
    try { localStorage.setItem(EARNED_KEY, String(earned + amount)); } catch (_) {}
    return next;
}

export function spendGold(amount) {
    const current = loadWallet();
    if (current < amount) return false;
    saveWallet(current - amount);
    return true;
}
