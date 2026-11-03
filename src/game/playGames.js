import { Capacitor, registerPlugin } from '@capacitor/core';
import { loadUnlocked, subscribeUnlocks } from './achievements.js';

// Google Play Games Services, in the Android app only (see PlayGamesPlugin.java).
// Everything here is safe to call on the web build: it just does nothing.
export const playGamesSupported = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const PlayGames = registerPlugin('PlayGames');

// Play Console achievement IDs (Play Games Services → Achievements), by the
// game's own ids in achievements.js (matched by title). Achievements left
// empty stay local only.
const PLAY_ACHIEVEMENT_IDS = Object.freeze({
    jetpack:        'CgkIjIzjoZEdEAIQDQ',
    boots:          'CgkIjIzjoZEdEAIQCQ',
    star:           'CgkIjIzjoZEdEAIQDg',
    gold_bag:       'CgkIjIzjoZEdEAIQEQ',
    gold_bar:       'CgkIjIzjoZEdEAIQEA',
    red_gem:        'CgkIjIzjoZEdEAIQCw',
    score_10000:    'CgkIjIzjoZEdEAIQBA',
    score_30000:    'CgkIjIzjoZEdEAIQBQ',
    score_100000:   'CgkIjIzjoZEdEAIQCg',
    wood_1000:      'CgkIjIzjoZEdEAIQCA',
    star_1000:      'CgkIjIzjoZEdEAIQDw',
    no_gold_10000:  'CgkIjIzjoZEdEAIQAg',
    no_power_10000: 'CgkIjIzjoZEdEAIQAQ',
    all_maxed:      'CgkIjIzjoZEdEAIQAw',
    jetpack_save:   'CgkIjIzjoZEdEAIQDA',
    liftoff:        'CgkIjIzjoZEdEAIQBg',
    gold_100000:    'CgkIjIzjoZEdEAIQBw',
});

// Play Console leaderboard ID (Play Games Services → Leaderboards) for the
// high score. While empty, scores stay local and the Settings button is hidden.
const PLAY_LEADERBOARD_ID = 'CgkIjIzjoZEdEAIQEw';
export const playLeaderboardAvailable = playGamesSupported && PLAY_LEADERBOARD_ID !== '';

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

// Resolves once the launch sign-in check has an answer (signed in or not), so
// the game can tell "not signed in" apart from "hasn't finished checking yet".
// Resolves right away where Play Games isn't available.
let markSignInChecked;
const signInChecked = playGamesSupported
    ? new Promise(resolve => { markSignInChecked = resolve; })
    : Promise.resolve();

export function whenSignInChecked() {
    return signInChecked;
}

// Play signs the player in on its own at launch; this picks up the result
// Play's answer to a sign-in check or attempt, with the reason logged when it's a no
function authResult({ authenticated, error }, what) {
    if (!authenticated) log(`${what}: not signed in`, error ? `(${error})` : '(no error from Play; the player may have closed the sign-in)');
    return authenticated;
}

export async function checkSignIn() {
    if (!playGamesSupported) return false;
    try {
        setSignedIn(authResult(await PlayGames.isAuthenticated(), 'sign-in check'));
    } catch (e) {
        log('sign-in check failed:', e?.message ?? e);
        setSignedIn(false);
    }
    markSignInChecked();
    return signedIn;
}

// The sign-in button, for players who skipped the automatic one
export async function signIn() {
    if (!playGamesSupported) return false;
    try {
        setSignedIn(authResult(await PlayGames.signIn(), 'sign-in'));
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

// The best score on this device, sent to the leaderboard. Play keeps only the
// player's best, so sending it again (after every run, on every sign-in) is
// harmless, and covers scores set before the leaderboard existed or while
// signed out.
export function pushHighScore() {
    if (!signedIn || !playLeaderboardAvailable) return;
    let best = 0;
    try { best = parseInt(localStorage.getItem('blundayHighScore'), 10) || 0; } catch (_) {}
    if (best <= 0) return;
    PlayGames.submitScore({ id: PLAY_LEADERBOARD_ID, score: best }).catch(e => log('score submit failed:', e?.message ?? e));
}

export async function showPlayLeaderboard() {
    if (!signedIn || !playLeaderboardAvailable) return;
    try {
        await PlayGames.showLeaderboard({ id: PLAY_LEADERBOARD_ID });
    } catch (e) {
        log('leaderboard screen failed:', e?.message ?? e);
    }
}

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
