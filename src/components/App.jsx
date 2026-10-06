import { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/engine.js';
import GameCanvas from './GameCanvas.jsx';
import ScoreHUD from './ScoreHUD.jsx';
import EffectBar from './EffectBar.jsx';
import StartOverlay from './StartOverlay.jsx';
import GameOverOverlay from './GameOverOverlay.jsx';
import AchievementsView from './AchievementsView.jsx';
import UpgradesView from './UpgradesView.jsx';
import SettingsView from './SettingsView.jsx';
import CreditsView from './CreditsView.jsx';
import SettingsButton from './SettingsButton.jsx';
import CharacterButton from './CharacterButton.jsx';
import CharacterView from './CharacterView.jsx';
import MoveHint from './MoveHint.jsx';
import FullscreenButton from './FullscreenButton.jsx';
import { installClickSounds, playSfx } from '../game/audio.js';
import { installReliableClicks } from '../game/buttons.js';
import { initAds, shouldOfferDouble, showRewardedAd } from '../game/ads.js';
import { subscribeUnlocks } from '../game/achievements.js';
import { rewardForAchievement, isWardrobeEnabled } from '../game/wardrobe.js';
import { subscribeSettings } from '../game/settings.js';

const MOVE_HINT_MS = 10000;

// Notifications show one after another, never on top of each other
const TOAST_MS        = 2200;
const REWARD_TOAST_MS = 3000; // a little longer when there's a reward to read
let toastSeq = 0;

// Safe area insets (system bars, camera cutout), measured through invisible
// probes sized by them, so a change to any inset shows up as a resize too.
// Capacitor's SystemBars plugin sets --safe-area-inset-*; browsers have env().
const SAFE_SIDES = ['top', 'right', 'bottom', 'left'];
function makeSafeAreaProbe(side) {
    const probe = document.createElement('div');
    const size = `var(--safe-area-inset-${side}, env(safe-area-inset-${side}, 0px))`;
    const vertical = side === 'top' || side === 'bottom';
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
        + (vertical ? `width:1px;height:${size}` : `height:1px;width:${size}`);
    document.body.appendChild(probe);
    return probe;
}

// The UI is laid out once at this width (1080x2400 / 2.5) and scaled to fit the
// game area, so it looks the same on every screen, just larger or smaller.
const UI_WIDTH = 432;

export default function App() {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Defaults so nothing dereferences undefined before the first snapshot
    const [snapshot, setSnapshot] = useState({
        gameState:    'idle',
        score:        0,
        highScore:    0,
        coins:        0,
        activeEffects: [],
        gold:         0,
        justSaved:    false,
    });

    const [view, setView] = useState('menu');
    // The wardrobe is part of Experimental Mode
    const [wardrobe, setWardrobe] = useState(isWardrobeEnabled);
    useEffect(() => subscribeSettings(() => setWardrobe(isWardrobeEnabled())), []);
    // Queued notifications: { key, kind: 'achievement' | 'save', title, reward }
    const [toasts, setToasts] = useState([]);
    // Rewarded "2x gold" offer for the current game over: null, or
    // { state: 'offer' | 'watching' | 'done' | 'failed', amount }
    const [adOffer, setAdOffer] = useState(null);
    // Start time of a first-ever run (no high score yet); drives the move hint
    const [moveHintRun, setMoveHintRun] = useState(null);

    // viewRef lets the empty-deps keydown effect read current view without re-subscribing
    const viewRef = useRef('menu');
    const wrapperRef = useRef(null);
    const uiRef = useRef(null);
    useEffect(() => { viewRef.current = view; }, [view]);
    useEffect(() => installClickSounds(wrapperRef.current), []);
    useEffect(() => installReliableClicks(wrapperRef.current), []);
    useEffect(() => { initAds(); }, []);

    // ── UI scaling — keep the UI layer covering the game area at any size ────
    useEffect(() => {
        const wrapper = wrapperRef.current;
        const ui = uiRef.current;
        if (!wrapper || !ui) return;
        const probes = Object.fromEntries(SAFE_SIDES.map(side => [side, makeSafeAreaProbe(side)]));

        function fitUi() {
            const scale = wrapper.clientWidth / UI_WIDTH;
            if (!scale) return; // not laid out yet
            ui.style.setProperty('--ui-scale', scale);
            ui.style.height = `${wrapper.clientHeight / scale}px`;
            // The game keeps drawing edge to edge, under the bars and the cutout;
            // only the UI steps in, by however much of each inset overlaps the
            // game area (on a wide or landscape screen the game is centered and
            // usually clear of them)
            const rect = wrapper.getBoundingClientRect();
            const viewW = document.documentElement.clientWidth;
            const viewH = document.documentElement.clientHeight;
            const overlap = {
                top:    probes.top.offsetHeight - rect.top,
                bottom: probes.bottom.offsetHeight - (viewH - rect.bottom),
                left:   probes.left.offsetWidth - rect.left,
                right:  probes.right.offsetWidth - (viewW - rect.right),
            };
            for (const side of SAFE_SIDES) {
                ui.style.setProperty(`--safe-${side}`, `${Math.max(0, overlap[side]) / scale}px`);
            }
        }
        fitUi();
        const observer = new ResizeObserver(fitUi);
        observer.observe(wrapper);
        for (const side of SAFE_SIDES) observer.observe(probes[side]);
        window.addEventListener('resize', fitUi);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', fitUi);
            for (const side of SAFE_SIDES) probes[side].remove();
        };
    }, []);

    // ── Main menu handler ─────────────────────────────────────────────────────
    function handleMainMenu() {
        const engine = engineRef.current;
        if (!engine) return;
        engine.toMenu();
        setView('menu');
        viewRef.current = 'menu';
    }

    function handleGameOverUpgrades() {
        const engine = engineRef.current;
        if (!engine) return;
        engine.toMenu();
        setView('upgrades');
        viewRef.current = 'upgrades';
    }

    // ── Single start/restart handler ─────────────────────────────────────────
    function handleStart() {
        const engine = engineRef.current;
        if (!engine) return;
        // Amendment #1: reset view to 'menu' before starting so Space-to-restart
        // is never gated by a stale 'achievements' view value.
        setView('menu');
        viewRef.current = 'menu';
        engine.reset();  // clears state, emits idle snapshot
        setMoveHintRun(engine.getSnapshot().highScore === 0 ? Date.now() : null);
        engine.start();  // sets gameState='running', starts RAF loop
    }

    // ── Engine lifecycle ──────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || engineRef.current) return; // guard against StrictMode double-invoke

        const engine = createGame(canvas);
        engineRef.current = engine;

        // Sync engine snapshots into React state
        const unsub = engine.subscribe(snap => setSnapshot({ ...snap }));

        // Start the RAF draw loop in idle mode (no gameplay yet)
        engine.startLoop();

        // Set React state to match the engine's initial snapshot
        setSnapshot(engine.getSnapshot());

        // ── Keyboard input ────────────────────────────────────────────────────
        let leftHeld  = false;
        let rightHeld = false;

        function sendInput() {
            engine.setInput(leftHeld, rightHeld);
        }

        function onKeyDown(e) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                e.preventDefault();
                leftHeld = true;
                sendInput();
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                e.preventDefault();
                rightHeld = true;
                sendInput();
            }
            // Space: start/restart — but not when overlay screens are open
            if (e.code === 'Space') {
                e.preventDefault();
                const state = engine.getSnapshot().gameState;
                if (state !== 'running' && viewRef.current === 'menu') {
                    handleStart();
                }
            }
        }

        function onKeyUp(e) {
            if (e.code === 'ArrowLeft'  || e.code === 'KeyA') {
                leftHeld = false;
                sendInput();
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                rightHeld = false;
                sendInput();
            }
        }

        function onTouchStart(e) {
            if (engine.getSnapshot().gameState !== 'running') return;
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            engine.setDragTargetFromClient(e.touches[0].clientX, rect.left, rect.width);
            e.preventDefault();
        }

        function onTouchMove(e) {
            if (engine.getSnapshot().gameState !== 'running') return;
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            engine.setDragTargetFromClient(e.touches[0].clientX, rect.left, rect.width);
            e.preventDefault();
        }

        function onTouchEnd(e) {
            if (e.touches.length === 0) {
                engine.clearDragTarget();
            }
        }

        const wrapper = wrapperRef.current;

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup',   onKeyUp);

        if (wrapper) {
            wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
            wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
            wrapper.addEventListener('touchend', onTouchEnd, { passive: false });
            wrapper.addEventListener('touchcancel', onTouchEnd, { passive: false });
        }

        return () => {
            engine.stop();
            unsub();
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup',   onKeyUp);
            if (wrapper) {
                wrapper.removeEventListener('touchstart', onTouchStart);
                wrapper.removeEventListener('touchmove', onTouchMove);
                wrapper.removeEventListener('touchend', onTouchEnd);
                wrapper.removeEventListener('touchcancel', onTouchEnd);
            }
            engineRef.current = null;
        };
    }, []); // empty deps: run once per mount

    // ── Notifications — achievements (from anywhere) and the jetpack save ─────
    // Unlocks that land together are queued and shown one after another, each
    // with its own sound, and mention the wardrobe item they unlock
    function queueToast(toast) {
        setToasts(q => [...q, { key: ++toastSeq, ...toast }]);
    }

    useEffect(() => subscribeUnlocks(def => {
        // The reward is only mentioned while the wardrobe (Experimental Mode) is on
        const reward = isWardrobeEnabled() ? rewardForAchievement(def.id)?.name : undefined;
        queueToast({ kind: 'achievement', title: def.title, reward });
    }), []);

    const toast = toasts[0] || null;
    useEffect(() => {
        if (!toast) return;
        if (toast.kind === 'achievement') playSfx('achievement');
        const t = setTimeout(() => setToasts(q => q.slice(1)), toast.reward ? REWARD_TOAST_MS : TOAST_MS);
        return () => clearTimeout(t);
    }, [toast?.key]); // once per notification, not on every re-render

    // The title screen cameos only play while the menu itself is up
    useEffect(() => {
        engineRef.current?.setTitleCameos(snapshot.gameState === 'idle' && view === 'menu');
    }, [snapshot.gameState, view]);

    // ── Move hint — visible for the first 10s of a run while there's no high score
    useEffect(() => {
        if (moveHintRun !== null) {
            const t = setTimeout(() => setMoveHintRun(null), MOVE_HINT_MS);
            return () => clearTimeout(t);
        }
    }, [moveHintRun]);

    // ── Save toast — queued when the jetpack revive activates ─────────────────
    useEffect(() => {
        if (snapshot.justSaved) queueToast({ kind: 'save' });
    }, [snapshot.justSaved]);

    // ── Rewarded ad offer — decided once as each run ends ──────────────────────
    useEffect(() => {
        if (snapshot.gameState !== 'gameover') {
            setAdOffer(null);
            return;
        }
        const runGold = snapshot.runGold || 0;
        if (shouldOfferDouble(runGold)) setAdOffer({ state: 'offer', amount: runGold });
    }, [snapshot.gameState]); // only when the state changes, not on every snapshot

    async function handleWatchAd() {
        setAdOffer(o => ({ ...o, state: 'watching' }));
        const result = await showRewardedAd(); // 'rewarded' | 'closed' | 'unavailable'
        const amount = result === 'rewarded' ? engineRef.current?.claimRunGoldBonus() : 0;
        const state = amount ? 'done' : result === 'closed' ? 'closed' : 'failed';
        setAdOffer(o => (o ? { ...o, state } : o));
    }

    const { gameState, score, highScore, activeEffects, gold } = snapshot;

    // Screens that open over both the title and the game over screen
    const sharedView =
        view === 'settings'  ? <SettingsView onBack={() => setView('menu')} onCredits={() => setView('credits')} /> :
        view === 'credits'   ? <CreditsView onBack={() => setView('settings')} /> :
        view === 'character' ? <CharacterView onBack={() => setView('menu')} /> :
        null;

    return (
        <div className="game-wrapper" ref={wrapperRef}>
            <GameCanvas ref={canvasRef} />
            <div className="ui-layer" ref={uiRef}>
                <ScoreHUD score={score} highScore={highScore} gold={gold} />
                {/* Title and game over screens share the character, settings and full screen buttons */}
                {(gameState === 'idle' || gameState === 'gameover') && view === 'menu' && (
                    <>
                        {wardrobe && <CharacterButton onClick={() => setView('character')} />}
                        <SettingsButton onClick={() => setView('settings')} />
                        <FullscreenButton />
                    </>
                )}
                {activeEffects.length > 0 && <EffectBar effects={activeEffects} />}
                <MoveHint visible={gameState === 'running' && moveHintRun !== null} />
                {gameState === 'idle' && (
                    sharedView ?? (
                        view === 'achievements'
                            ? <AchievementsView onBack={() => setView('menu')} />
                            : view === 'upgrades'
                                ? <UpgradesView onBack={() => setView('menu')} />
                                : <StartOverlay onPlay={handleStart} onAchievements={() => setView('achievements')} onUpgrades={() => setView('upgrades')} />
                    )
                )}
                {gameState === 'gameover' && (
                    sharedView ?? (
                        <GameOverOverlay
                            score={score}
                            highScore={highScore}
                            onRestart={handleStart}
                            onUpgrades={handleGameOverUpgrades}
                            onMenu={handleMainMenu}
                            offer={adOffer && { ...adOffer, onWatch: handleWatchAd }}
                        />
                    )
                )}
                {toast && (
                    <div className="toast" key={toast.key}>
                        {toast.kind === 'save'
                            ? 'Saved by your Ctrl+Z Jetpack!'
                            : <>
                                <span>Achievement unlocked: {toast.title}</span>
                                {toast.reward && <span className="toast-reward">Unlocked: {toast.reward}</span>}
                            </>}
                    </div>
                )}
            </div>
        </div>
    );
}
