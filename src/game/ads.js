import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';

// Rewarded "2x gold" ads, in the Android app only. The web build (desktop or
// mobile browser) never shows ads: Capacitor reports a native platform only
// when the game runs inside the installed app.
export const adsSupported = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

// The "2x gold" rewarded ad unit in AdMob. (The app ID lives in
// android/app/src/main/res/values/strings.xml.)
// USE_TEST_ADS swaps in Google's always-available test ad instead, for
// development; your own phone should be registered as a test device in AdMob
// (Settings → Test devices) so it never gets real ads.
const REWARDED_AD_ID = 'ca-app-pub-4815546289908139/2408906957';
const USE_TEST_ADS   = false;

// How often the offer comes up: after a random number of runs in this range,
// on the first of them that earned at least MIN_OFFER_GOLD. [1, 1] offers it
// after every run that earns enough; e.g. [5, 10] would space it out.
const OFFER_EVERY_RUNS = [1, 1];
const MIN_OFFER_GOLD   = 25;
const STORAGE_KEY      = 'blundayAdOffer';

let ready   = false; // SDK initialized and consent allows ads
let loaded  = false; // a rewarded ad is loaded and waiting
let loading = null;
let privacyOptionsRequired = false;

// Every decision the ad code makes is logged with this prefix, so a missing
// offer can be traced in chrome://inspect (or Logcat, tag Capacitor/Console)
function log(...args) {
    console.info('[ads]', ...args);
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Offer pacing ───────────────────────────────────────────────────────────
function runsUntilOffer() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        // Clamped, so a countdown saved under a longer spacing doesn't carry over
        if (stored !== null) return Math.min(parseInt(stored, 10) || 0, OFFER_EVERY_RUNS[1]);
    } catch (_) {}
    return randInt(...OFFER_EVERY_RUNS);
}

function saveRunsUntilOffer(n) {
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch (_) {}
}

// Called once per finished run. Returns true when this game over should offer
// to double the run's gold. It's only offered with an ad already loaded, so
// the button never leads to "no ad available". Once offered, the countdown
// starts over whether or not the player watches.
export function shouldOfferDouble(runGold) {
    if (!adsSupported) return false;
    const left = Math.max(runsUntilOffer() - 1, 0);
    if (left > 0 || runGold < MIN_OFFER_GOLD || !ready || !loaded) {
        log(`no offer: ${left} run(s) to go, ${runGold}/${MIN_OFFER_GOLD} gold, ads ready: ${ready}, ad loaded: ${loaded}`);
        saveRunsUntilOffer(left); // stays at 0 until a run earns enough
        preload(); // try again for next time
        return false;
    }
    log(`offering 2x for ${runGold} gold`);
    saveRunsUntilOffer(randInt(...OFFER_EVERY_RUNS));
    preload();
    return true;
}

// ─── SDK ────────────────────────────────────────────────────────────────────
// Initializes AdMob and asks for consent where required (EEA/UK), then loads
// the first ad in the background. Safe to call on any platform.
export async function initAds() {
    if (!adsSupported) return;
    try {
        await AdMob.initialize({ initializeForTesting: USE_TEST_ADS });
    } catch (e) {
        log('AdMob failed to start, no ads this session:', e?.message ?? e);
        return;
    }
    try {
        let consent = await AdMob.requestConsentInfo();
        log('consent:', JSON.stringify(consent));
        if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
            consent = await AdMob.showConsentForm();
            log('consent after form:', JSON.stringify(consent));
        } else if (consent.status === AdmobConsentStatus.REQUIRED) {
            log('consent required but no form: publish a GDPR message in AdMob (Privacy & messaging)');
        }
        privacyOptionsRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
        ready = consent.canRequestAds;
    } catch (e) {
        // A failed consent lookup (e.g. offline) shouldn't rule ads out:
        // AdMob still applies its own rules to the request
        log('consent check failed, trying ads anyway:', e?.message ?? e);
        ready = true;
    }
    log(ready ? 'ready, loading an ad' : 'ads not allowed by consent');
    if (ready) preload();
}

function preload() {
    if (!ready || loaded || loading) return loading;
    loading = AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID, isTesting: USE_TEST_ADS })
        .then(() => { loaded = true; log('ad loaded'); })
        .catch(e => { loaded = false; log('ad failed to load:', e?.message ?? JSON.stringify(e)); })
        .finally(() => { loading = null; });
    return loading;
}

// Shows the rewarded ad. Resolves 'rewarded' only if the player watched it
// through (AdMob's reward event), 'closed' if they closed it early, or
// 'unavailable' if no ad could be shown.
export async function showRewardedAd() {
    if (!ready) return 'unavailable';
    if (!loaded) await preload();
    if (!loaded) return 'unavailable';
    loaded = false;

    let rewarded = false;
    const handles = [];
    const done = new Promise(resolve => {
        handles.push(
            AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }),
            AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve('closed')),
            AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve('unavailable')),
        );
    });
    let outcome;
    try {
        await Promise.all(handles);
        AdMob.showRewardVideoAd().catch(() => {}); // outcome comes from the events above
        outcome = await done;
    } finally {
        for (const h of handles) h.then(l => l.remove()).catch(() => {});
        preload(); // have the next one ready
    }
    return rewarded ? 'rewarded' : outcome;
}

// Players in the EEA/UK must be able to revisit their ad consent choice
export function needsPrivacyOptions() {
    return adsSupported && privacyOptionsRequired;
}

export async function showPrivacyOptions() {
    try { await AdMob.showPrivacyOptionsForm(); } catch (_) {}
}
