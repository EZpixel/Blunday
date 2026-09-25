const STORAGE_KEY = 'blundaySettings';

// Volumes are 0..1. Each channel also has an on/off flag so muting keeps the
// slider position for when it's turned back on.
const DEFAULTS = Object.freeze({
    masterVolume: 1,
    masterOn:     true,
    sfxVolume:    1,
    sfxOn:        true,
    musicVolume:  1,
    musicOn:      true,
    experimental: false,
});

function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return { ...DEFAULTS, ...JSON.parse(stored) };
    } catch (_) {}
    return { ...DEFAULTS };
}

let settings = loadSettings();
const subscribers = new Set();

export function getSettings() {
    return settings;
}

export function updateSettings(patch) {
    settings = { ...settings, ...patch };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
    for (const fn of subscribers) fn(settings);
}

export function subscribeSettings(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function isExperimental() {
    return settings.experimental;
}
