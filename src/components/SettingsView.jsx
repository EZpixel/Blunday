import { useEffect, useState } from 'react';
import { clearSaveData } from '../game/storage.js';
import { getSettings, updateSettings, subscribeSettings } from '../game/settings.js';
import BackButton from './BackButton.jsx';
import MenuEmblem from './MenuEmblem.jsx';
import { needsPrivacyOptions, showPrivacyOptions } from '../game/ads.js';
import { playGamesSupported, isSignedIn, subscribeSignIn, showPlayAchievements, showPlayLeaderboard, playLeaderboardAvailable } from '../game/playGames.js';
import { signInAndSync } from '../game/cloudSave.js';
import PlayGamesLogo from './PlayGamesLogo.jsx';
import { notify } from '../game/notify.js';

function SpeakerIcon({ muted }) {
    return (
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 7.5 H6.5 L11 3.5 V16.5 L6.5 12.5 H3 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            {muted
                ? <path d="M13.5 7.5 L18 12 M18 7.5 L13.5 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                : <path d="M14 7 Q16 10 14 13 M16 5 Q19.5 10 16 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
    );
}

// Slider with its on/off toggle built in: the speaker button mutes the channel
// without losing the slider position, and dragging the slider turns it back on.
function VolumeSlider({ label, channel, settings }) {
    const on     = settings[`${channel}On`];
    const volume = settings[`${channel}Volume`];
    const pct    = Math.round(volume * 100);
    const muted  = !on || pct === 0;

    return (
        <div className={`volume-row${on ? '' : ' off'}`}>
            <button
                className="volume-toggle"
                aria-pressed={on}
                aria-label={`${label} ${on ? 'on' : 'off'}`}
                title={on ? `Turn ${label} off` : `Turn ${label} on`}
                onClick={() => updateSettings({ [`${channel}On`]: !on })}
            >
                <SpeakerIcon muted={muted} />
            </button>
            <label className="volume-body">
                <span className="volume-label">
                    {label}
                    <span className="volume-value">{on ? `${pct}%` : 'Off'}</span>
                </span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={pct}
                    style={{ '--fill': `${on ? pct : 0}%` }}
                    onChange={e => updateSettings({ [`${channel}Volume`]: e.target.value / 100, [`${channel}On`]: true })}
                />
            </label>
        </div>
    );
}

export default function SettingsView({ onBack, onCredits }) {
    const [confirming, setConfirming] = useState(false);
    const [settings, setSettings] = useState(getSettings);
    useEffect(() => subscribeSettings(setSettings), []);
    const [signedIn, setSignedIn] = useState(isSignedIn);
    // Connect Play Games: 'idle' | 'connecting'
    const [connect, setConnect] = useState('idle');

    async function handleConnect() {
        setConnect('connecting');
        // On success the button turns into "Play Games" (and the game may reload
        // to bring in cloud progress); on failure a notification says so
        const ok = await signInAndSync();
        setConnect('idle');
        if (!ok) notify("Couldn't connect to Play Games. Please try again later.");
    }
    useEffect(() => subscribeSignIn(setSignedIn), []);

    return (
        <div className="overlay list-overlay settings-overlay">
            <div className="overlay-header">
                <h1 className="fancy-heading settings-heading">Settings</h1>

                <section className="settings-section">
                    <h2>Sound</h2>
                    <VolumeSlider label="Master" channel="master" settings={settings} />
                    <VolumeSlider label="SFX"    channel="sfx"    settings={settings} />
                    <VolumeSlider label="Music"  channel="music"  settings={settings} />
                </section>
            </div>

            <section className="settings-section">
                <h2>Experimental</h2>
                <div className="settings-switch-row">
                    <div>
                        <strong>Experimental Mode</strong>
                        <span>Brand new features first. Right now: a rather rude sound when Blunday falls. Things may get weird.</span>
                    </div>
                    <button
                        className="settings-switch"
                        role="switch"
                        aria-checked={settings.experimental}
                        aria-label="Experimental Mode"
                        onClick={() => updateSettings({ experimental: !settings.experimental })}
                    >
                        <span className="settings-switch-knob" />
                    </button>
                </div>
            </section>

            <div className="settings-footer">
                <section className="settings-section">
                    <h2>Progress</h2>
                    {/* Signed in, progress is backed up to the player's Google account */}
                    {playGamesSupported && (signedIn
                        ? <>
                            {/* Play Games v2 has no sign-out, so being connected is
                                just a status; the button opens Play's own achievements */}
                            <p className="play-games-status"><PlayGamesLogo />Connected to Play Games</p>
                            <button className="emblem-button" onClick={showPlayAchievements}><MenuEmblem icon="trophy" />Play Achievements</button>
                            {playLeaderboardAvailable && (
                                <button className="emblem-button" onClick={showPlayLeaderboard}><MenuEmblem icon="podium" />Leaderboard</button>
                            )}
                        </>
                        : <button className="emblem-button play-games-connect" onClick={handleConnect} disabled={connect === 'connecting'}>
                            <PlayGamesLogo />{connect === 'connecting' ? 'Connecting...' : 'Connect Play Games'}
                        </button>)}
                    <button onClick={() => setConfirming(true)}>Reset Progress</button>
                </section>

                <section className="settings-section">
                    <h2>About</h2>
                    <button className="emblem-button" onClick={onCredits}><MenuEmblem icon="heart" />Credits</button>
                    {needsPrivacyOptions() && <button onClick={showPrivacyOptions}>Ad Privacy Options</button>}
                </section>
            </div>

            <BackButton onClick={onBack} />

            {confirming && <ResetConfirmDialog onCancel={() => setConfirming(false)} />}
        </div>
    );
}

// Popup over the whole Settings screen, asking before Reset Progress wipes
// everything. Tapping outside the panel cancels, like the Cancel button.
function ResetConfirmDialog({ onCancel }) {
    const [resetting, setResetting] = useState(false);

    function handleConfirm() {
        setResetting(true);
        clearSaveData(); // clears the cloud copy too, then reloads the game
    }

    return (
        <div className="confirm-backdrop" onClick={e => { if (e.target === e.currentTarget && !resetting) onCancel(); }}>
            <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-confirm-text">
                <p id="reset-confirm-text" className="settings-warning">
                    This will permanently delete your progress. Are you sure?
                </p>
                <div className="settings-confirm-row">
                    <button onClick={handleConfirm} disabled={resetting}>
                        {resetting ? 'Resetting...' : 'Confirm Reset'}
                    </button>
                    <button className="grey-button" onClick={onCancel} disabled={resetting}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
