import { playGamesSupported, isSignedIn, whenSignInChecked } from './playGames.js';

// The one-time "back up your progress?" prompt on the title screen, for
// Android players that Play Games didn't sign in automatically at launch.
// Whether it has been answered is remembered on this device only: the key is
// not part of the cloud save, so a new phone asks again until it's signed in.
const STORAGE_KEY = 'blundayPlayGamesPrompted';

function wasAnswered() {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch (_) { return false; }
}

// Connected or "Not now": either way, don't ask again on this device
export function markPlayGamesPromptAnswered() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
}

// Resolves true when the prompt should show: on Android, not yet answered,
// and still not signed in once the launch sign-in check has finished.
export async function shouldShowPlayGamesPrompt() {
    if (!playGamesSupported || wasAnswered()) return false;
    await whenSignInChecked();
    return !isSignedIn();
}
