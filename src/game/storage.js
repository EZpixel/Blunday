export function clearSaveData() {
    try {
        localStorage.removeItem('blundayHighScore');
        localStorage.removeItem('blundayGold');
        localStorage.removeItem('blundayUpgrades');
        localStorage.removeItem('blundayAchievements');
    } catch (_) {}
    window.location.reload();
}

export function migrateLegacySaveData() {
    const pairs = [
        ['doodleHighScore', 'blundayHighScore'],
        ['doodleGold', 'blundayGold'],
        ['doodleUpgrades', 'blundayUpgrades'],
        ['doodleAchievements', 'blundayAchievements'],
    ];
    for (const [oldKey, newKey] of pairs) {
        try {
            const oldValue = localStorage.getItem(oldKey);
            if (oldValue !== null && localStorage.getItem(newKey) === null) {
                localStorage.setItem(newKey, oldValue);
            }
            localStorage.removeItem(oldKey);
        } catch {}
    }
}
