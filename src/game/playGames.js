import { Capacitor, registerPlugin } from '@capacitor/core';
import { loadUnlocked, subscribeUnlocks } from './achievements.js';

// Google Play Games Services, in the Android app only (see PlayGamesPlugin.java).
// Everything here is safe to call on the web build: it just does nothing.
export const playGamesSupported = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const PlayGames = registerPlugin('PlayGames');

// Play Console achievement IDs (Play Games Services → Achievements), by the
// game's own ids in achievements.js. Achievements left empty stay local only.
const PLAY_ACHIEVEMENT_IDS = Object.freeze({
    jetpack:        '',
    boots:          '',
    star:           '',
    gold_bag:       '',
    gold_bar:       '',
    red_gem:        '',
    score_10000:    '',
    score_30000:    '',
    score_100000:   '',
    wood_1000:      '',
    star_1000:      '',
    no_gold_10000:  '',
    no_power_10000: '',
    all_maxed:      '',
    jetpack_save:   '',
    liftoff:        '',
    gold_100000:    '',
});

let signedIn = false;
const subscribers = new Set();

function log(...args) {
    console.info('[play-games]', ...args);
}

function setSignedIn(value) {
    if (signedIn === value) return;
    signedIn = value;
    for (const fn of subscribers) fn(signedIn);
}

export function isSignedIn() {
    return signedIn;
}

export function subscribeSignIn(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

// Play signs the player in on its own at launch; this picks up the result
export async function checkSignIn() {
    if (!playGamesSupported) return false;
    try {
        setSignedIn((await PlayGames.isAuthenticated()).authenticated);
    } catch (e) {
        log('sign-in check failed:', e?.message ?? e);
        setSignedIn(false);
    }
    return signedIn;
}

// The sign-in button, for players who skipped the automatic one
export async function signIn() {
    if (!playGamesSupported) return false;
    try {
        setSignedIn((await PlayGames.signIn()).authenticated);
    } catch (e) {
        log('sign-in failed:', e?.message ?? e);
    }
    return signedIn;
}

function unlockOnPlay(id) {
    const playId = PLAY_ACHIEVEMENT_IDS[id];
    if (!signedIn || !playId) return;
    PlayGames.unlockAchievement({ id: playId }).catch(e => log(`unlock ${id} failed:`, e?.message ?? e));
}

// Everything unlocked so far, including achievements earned before Play Games
// was added or while signed out. Play ignores unlocks it already has.
export function pushUnlockedAchievements() {
    for (const id of Object.keys(loadUnlocked())) unlockOnPlay(id);
}

if (playGamesSupported) subscribeUnlocks(def => unlockOnPlay(def.id));

export async function showPlayAchievements() {
    if (!signedIn) return;
    try {
        await PlayGames.showAchievements();
    } catch (e) {
        log('achievements screen failed:', e?.message ?? e);
    }
}

// Raw cloud save text ('' when there is none yet)
export async function loadCloudSave() {
    return (await PlayGames.loadSave()).data || '';
}

export async function writeCloudSave(data) {
    await PlayGames.writeSave({ data });
}
