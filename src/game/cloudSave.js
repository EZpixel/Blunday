import {
    playGamesSupported, isSignedIn, checkSignIn, signIn,
    pushUnlockedAchievements, pushHighScore, loadCloudSave, writeCloudSave,
} from './playGames.js';

// Cloud save through Play Games Saved Games: the localStorage progress keys,
// bundled into one JSON blob. Local and cloud copies are always merged, never
// swapped for one another, so neither side can wipe out the other's progress:
// the first sync after an update uploads what's already on the phone, and a
// new install picks up what's in the cloud.
//
// Merging happens in two places:
// - At launch (initCloudSave), before the game modules load and cache their
//   saves: the merge is written to localStorage, so this device picks up
//   progress from other devices or an earlier install.
// - Afterwards (requestSync, at the end of each run and when the app goes to the
//   background): the merge is only uploaded. localStorage is left alone, since
//   modules like the wardrobe and settings keep their own in-memory copies.
//   Anything new in the cloud reaches this device on its next launch.

const SAVE_VERSION = 1;
// Launch waits this long for the cloud at most; a slow network shouldn't keep
// the game from starting. A sync that finishes later is only uploaded.
const STARTUP_TIMEOUT_MS = 5000;

function maxEach(local, cloud) {
    const out = { ...cloud, ...local };
    for (const key of Object.keys(out)) out[key] = Math.max(local[key] || 0, cloud[key] || 0);
    return out;
}

function unique(list) {
    return [...new Set(list)];
}

// How each synced key merges, given both a local and a cloud value.
// Progress only ever grows, so it merges to the larger value or the union;
// preferences (the equipped look, settings) keep this device's choice.
const MERGE = {
    blundayHighScore:    Math.max,
    blundayUpgrades:     maxEach,
    blundayAchievements: (local, cloud) => ({ ...cloud, ...local }),
    blundayStats:        maxEach,
    blundayWardrobe:     (local, cloud) => ({
        look:     local.look,
        unlocked: unique([...(local.unlocked || []), ...(cloud.unlocked || [])]),
    }),
    blundaySettings:     local => local,
};

// The wallet is the one value that goes down (spending), so the balance and the
// lifetime total move together: whichever copy earned more is further along,
// and with equal earnings the lower balance is the one that has spent since.
const GOLD_KEY   = 'blundayGold';
const EARNED_KEY = 'blundayGoldEarned';

function walletOf(save) {
    if (save[GOLD_KEY] === undefined) return null;
    // Saves from before the lifetime counter existed: the balance is all earned (see wallet.js)
    return { gold: save[GOLD_KEY], earned: save[EARNED_KEY] ?? save[GOLD_KEY] };
}

function mergeWallet(local, cloud) {
    if (!local || !cloud) return local || cloud;
    if (local.earned !== cloud.earned) return local.earned > cloud.earned ? local : cloud;
    return local.gold <= cloud.gold ? local : cloud;
}

const SYNCED_KEYS = [...Object.keys(MERGE), GOLD_KEY, EARNED_KEY];

function merge(local, cloud) {
    const out = {};
    for (const [key, mergeValues] of Object.entries(MERGE)) {
        const l = local[key];
        const c = cloud[key];
        const value = l === undefined ? c : c === undefined ? l : mergeValues(l, c);
        if (value !== undefined) out[key] = value;
    }
    const wallet = mergeWallet(walletOf(local), walletOf(cloud));
    if (wallet) {
        out[GOLD_KEY]   = wallet.gold;
        out[EARNED_KEY] = wallet.earned;
    }
    return out;
}

// Every synced value is a number or JSON in localStorage, so JSON reads them all
function readLocal() {
    const save = {};
    for (const key of SYNCED_KEYS) {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) save[key] = JSON.parse(stored);
        } catch (_) {}
    }
    return save;
}

function writeLocal(save) {
    for (const [key, value] of Object.entries(save)) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    }
}

function serialize(save) {
    return JSON.stringify({ v: SAVE_VERSION, data: save });
}

// For comparing saves: the same save with its keys in another order is no change
function canonical(save) {
    return JSON.stringify(save, (_, value) => value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
        : value);
}

function parse(text) {
    if (!text) return {};
    const blob = JSON.parse(text);
    // Written by a newer version of the game: merging it here could drop
    // progress this version doesn't know about
    if (blob.v > SAVE_VERSION) throw new Error(`cloud save is version ${blob.v}, this game reads ${SAVE_VERSION}`);
    return blob.data || {};
}

function log(...args) {
    console.info('[cloud-save]', ...args);
}

// Merges local and cloud progress, writes the merge to localStorage when
// writeLocal() allows it, and uploads it if the cloud doesn't have it yet.
// Resolves true when localStorage changed.
async function syncWithCloud(canWriteLocal) {
    const cloud = parse(await loadCloudSave());
    const local = readLocal();
    const merged = merge(local, cloud);
    let changed = false;
    if (canWriteLocal() && canonical(merged) !== canonical(local)) {
        writeLocal(merged);
        changed = true;
    }
    if (canonical(merged) !== canonical(cloud)) await writeCloudSave(serialize(merged));
    return changed;
}

// ─── Launch ─────────────────────────────────────────────────────────────────
// Called before the game modules load (see main.jsx). Never throws, and gives
// up waiting after STARTUP_TIMEOUT_MS.
export async function initCloudSave() {
    if (!playGamesSupported) return;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') requestSync();
    });

    let started = false; // the game has loaded: localStorage is off limits now
    const work = (async () => {
        if (!(await checkSignIn())) return log('not signed in, progress stays on this device');
        const changed = await syncWithCloud(() => !started);
        log(changed ? 'restored progress from the cloud' : 'in sync');
        pushUnlockedAchievements();
        pushHighScore();
    })().catch(e => log('sync failed:', e?.message ?? e));

    await Promise.race([work, new Promise(resolve => setTimeout(resolve, STARTUP_TIMEOUT_MS))]);
    started = true;
}

// ─── During play ────────────────────────────────────────────────────────────
// One upload at a time; a request during an upload runs once it's done
let uploading = null;
let uploadAgain = false;

export function requestSync() {
    if (!isSignedIn()) return;
    if (uploading) {
        uploadAgain = true;
        return;
    }
    uploading = syncWithCloud(() => false)
        .catch(e => log('upload failed:', e?.message ?? e))
        .finally(() => {
            uploading = null;
            if (uploadAgain) {
                uploadAgain = false;
                requestSync();
            }
        });
}

// The Settings sign-in button. Progress found in the cloud is merged in and
// the game reloads to pick it up. Resolves whether the player is signed in.
export async function signInAndSync() {
    if (!(await signIn())) return false;
    try {
        await uploading;
        const changed = await syncWithCloud(() => true);
        pushUnlockedAchievements();
        pushHighScore();
        if (changed) window.location.reload();
    } catch (e) {
        log('sync failed:', e?.message ?? e);
    }
    return true;
}

// Reset Progress: the cloud copy goes too, or the next launch would merge it
// straight back in
export async function clearCloudSave() {
    if (!isSignedIn()) return;
    try {
        await uploading;
        await writeCloudSave(serialize({}));
    } catch (e) {
        log('clearing the cloud save failed:', e?.message ?? e);
    }
}
