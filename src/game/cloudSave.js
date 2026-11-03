import {
    playGamesSupported, isSignedIn, checkSignIn, signIn, getPlayerId, setLocalSaveIsPlayers,
    pushUnlockedAchievements, pushHighScore, loadCloudSave, writeCloudSave,
} from './playGames.js';
import { ACHIEVEMENTS } from './achievements.js';
import { UPGRADES } from './upgrades.js';

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
//
// The progress in localStorage belongs to one Play Games player, recorded
// under OWNER_KEY. Merging only ever happens with that player's own cloud
// save. When another player signs in on this device, the current progress is
// set aside for its owner (STASH_KEY) and the new player's own progress is
// loaded in its place; switching back brings the first player's progress back.
// A save with no owner yet (a first sign-in, or a save from before owners were
// recorded) goes to the first player who signs in.

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

// ─── Validation ─────────────────────────────────────────────────────────────
// Both copies are cleaned before merging. The merge keeps the larger value
// for good, so one bad save (a hand-edited backup, a broken write) would
// otherwise stick in the cloud and on every device it syncs to. Values that
// can't be right are dropped or clamped; the rest of the save is kept.
// achievements.js and upgrades.js hold no state of their own at load time,
// so importing their definitions here doesn't read the save before the merge
// (see main.jsx). wardrobe.js does, so its items are checked by shape only.
const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map(a => a.id));
const MAX_TIER = Object.fromEntries(UPGRADES.map(u => [u.id, u.maxTier]));
const MAX_WARDROBE_ITEMS = 200;
const MAX_ID_LENGTH = 64;

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// A whole number from 0 up to the largest integer JS represents exactly, or undefined
function count(v) {
    return Number.isSafeInteger(v) && v >= 0 ? v : undefined;
}

function cleanCounts(obj, maxOf) {
    if (!isPlainObject(obj)) return undefined;
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        const n = count(value);
        if (n === undefined) continue;
        if (maxOf) {
            if (!(key in maxOf)) continue;
            out[key] = Math.min(n, maxOf[key]);
        } else {
            out[key] = n;
        }
    }
    return out;
}

const isId = v => typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH;

const CLEAN = {
    blundayHighScore:    count,
    blundayUpgrades:     v => cleanCounts(v, MAX_TIER),
    blundayStats:        v => cleanCounts(v),
    blundayAchievements: v => isPlainObject(v)
        ? Object.fromEntries(Object.keys(v).filter(id => ACHIEVEMENT_IDS.has(id) && v[id]).map(id => [id, true]))
        : undefined,
    blundayWardrobe:     v => isPlainObject(v)
        ? {
            ...(isPlainObject(v.look) ? { look: v.look } : {}),
            unlocked: Array.isArray(v.unlocked) ? unique(v.unlocked.filter(isId)).slice(0, MAX_WARDROBE_ITEMS) : [],
        }
        : undefined,
    blundaySettings:     v => isPlainObject(v) ? v : undefined,
    [GOLD_KEY]:          count,
    [EARNED_KEY]:        count,
};

function clean(save) {
    const out = {};
    if (!isPlainObject(save)) return out;
    for (const [key, cleanValue] of Object.entries(CLEAN)) {
        if (save[key] === undefined) continue;
        const value = cleanValue(save[key]);
        if (value !== undefined) out[key] = value;
    }
    // The lifetime total includes everything still in the wallet
    if (out[GOLD_KEY] !== undefined && out[EARNED_KEY] !== undefined && out[EARNED_KEY] < out[GOLD_KEY]) {
        out[EARNED_KEY] = out[GOLD_KEY];
    }
    return out;
}

function merge(rawLocal, rawCloud) {
    const local = clean(rawLocal);
    const cloud = clean(rawCloud);
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
    if (blob?.v > SAVE_VERSION) throw new Error(`cloud save is version ${blob.v}, this game reads ${SAVE_VERSION}`);
    return blob?.data || {};
}

function log(...args) {
    console.info('[cloud-save]', ...args);
}

// ─── Owner ──────────────────────────────────────────────────────────────────
const OWNER_KEY = 'blundaySaveOwner';
const STASH_KEY = 'blundaySaveStash';
const SETTINGS_KEY = 'blundaySettings';

function readOwner() {
    try { return localStorage.getItem(OWNER_KEY); } catch (_) { return null; }
}

function writeOwner(playerId) {
    try { localStorage.setItem(OWNER_KEY, playerId); } catch (_) {}
}

// Progress set aside for players who aren't signed in on this device right
// now, by player ID
function readStash() {
    try {
        const stash = JSON.parse(localStorage.getItem(STASH_KEY));
        return isPlainObject(stash) ? stash : {};
    } catch (_) {
        return {};
    }
}

function writeStash(stash) {
    try {
        if (Object.keys(stash).length) localStorage.setItem(STASH_KEY, JSON.stringify(stash));
        else localStorage.removeItem(STASH_KEY);
    } catch (_) {}
}

// Unlike writeLocal, also removes synced keys the save doesn't have, so
// nothing of the previous player's progress stays behind
function replaceLocal(save) {
    for (const key of SYNCED_KEYS) {
        try {
            if (save[key] === undefined) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(save[key]));
        } catch (_) {}
    }
}

// Another player signed in: sets the current progress aside for its owner and
// loads the signed-in player's own (what they left on this device, merged with
// their cloud save). The settings are the device's and stay as they are.
async function switchPlayer(owner, playerId, local, cloud) {
    const stash = readStash();
    const theirs = clean(stash[playerId]);
    stash[owner] = local;
    delete stash[playerId];

    const merged = merge(theirs, cloud);
    if (local[SETTINGS_KEY] !== undefined) merged[SETTINGS_KEY] = local[SETTINGS_KEY];
    else delete merged[SETTINGS_KEY];

    writeStash(stash);
    replaceLocal(merged);
    writeOwner(playerId);
    setLocalSaveIsPlayers(true);
    log('another player signed in: switched to their progress');
    if (canonical(merged) !== canonical(cloud)) await writeCloudSave(serialize(merged));
}

// Merges local and cloud progress, writes the merge to localStorage when
// writeLocal() allows it, and uploads it if the cloud doesn't have it yet.
// Resolves true when localStorage changed. When the local progress belongs to
// another player, it's swapped for the signed-in player's instead, and the
// game reloads to pick that up if it's already running.
async function syncWithCloud(canWriteLocal) {
    const playerId = await getPlayerId();
    const owner = readOwner();
    if (owner && owner !== playerId) {
        setLocalSaveIsPlayers(false);
        const cloud = parse(await loadCloudSave());
        await switchPlayer(owner, playerId, readLocal(), cloud);
        // Game modules hold the previous player's progress in memory
        if (!canWriteLocal()) window.location.reload();
        return true;
    }
    if (!owner) writeOwner(playerId);
    setLocalSaveIsPlayers(true);
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
