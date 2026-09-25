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
import SettingsButton from './SettingsButton.jsx';

export default function App() {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Amendment #3: include justUnlocked default so nothing dereferences undefined
    const [snapshot, setSnapshot] = useState({
        gameState:    'idle',
        score:        0,
        highScore:    0,
        coins:        0,
        activeEffects: [],
        justUnlocked: [],
        gold:         0,
        justSaved:    false,
    });

    const [view, setView] = useState('menu');
    const [toast, setToast] = useState(null);
    const [saveToast, setSaveToast] = useState(false);

    // viewRef lets the empty-deps keydown effect read current view without re-subscribing
    const viewRef = useRef('menu');
    const wrapperRef = useRef(null);
    useEffect(() => { viewRef.current = view; }, [view]);

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
                if (state !== 'running' && viewRef.current !== 'achievements' && viewRef.current !== 'upgrades' && viewRef.current !== 'settings') {
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

    // ── Toast effect — show first unlocked achievement ────────────────────────
    // Amendment #3: guard on .length > 0 explicitly, not just truthiness
    useEffect(() => {
        if (snapshot.justUnlocked && snapshot.justUnlocked.length > 0) {
            setToast(snapshot.justUnlocked[0]);
        }
    }, [snapshot.justUnlocked]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 2000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    // ── Save toast — show when jetpack revive activates ───────────────────────
    useEffect(() => {
        if (snapshot.justSaved) {
            setSaveToast(true);
        }
    }, [snapshot.justSaved]);

    useEffect(() => {
        if (saveToast) {
            const t = setTimeout(() => setSaveToast(false), 3000);
            return () => clearTimeout(t);
        }
    }, [saveToast]);

    const { gameState, score, highScore, activeEffects, gold } = snapshot;

    return (
        <div className="game-wrapper" ref={wrapperRef}>
            <GameCanvas ref={canvasRef} />
            <ScoreHUD score={score} highScore={highScore} gold={gold} />
            {gameState === 'idle' && view === 'menu' && <SettingsButton onClick={() => setView('settings')} />}
            {activeEffects.length > 0 && <EffectBar effects={activeEffects} />}
            {gameState === 'idle' && (
                view === 'achievements'
                    ? <AchievementsView onBack={() => setView('menu')} />
                    : view === 'upgrades'
                        ? <UpgradesView onBack={() => setView('menu')} />
                        : view === 'settings'
                            ? <SettingsView onBack={() => setView('menu')} />
                            : <StartOverlay onPlay={handleStart} onAchievements={() => setView('achievements')} onUpgrades={() => setView('upgrades')} />
            )}
            {gameState === 'gameover' && (
                <GameOverOverlay
                    score={score}
                    highScore={highScore}
                    onRestart={handleStart}
                    onUpgrades={handleGameOverUpgrades}
                    onMenu={handleMainMenu}
                />
            )}
            {toast && <div className="toast">Achievement unlocked: {toast.title}</div>}
            {saveToast && <div className="toast">Saved by your Ctrl+Z Jetpack!</div>}
        </div>
    );
}
