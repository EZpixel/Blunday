import { useState } from 'react';
import { randomSplash } from '../game/splashes.js';
import { isMobile } from '../game/device.js';

export default function StartOverlay({ onPlay, onAchievements, onUpgrades }) {
    const [splash] = useState(() => randomSplash());
    return (
        <div className="overlay start-overlay">
            <div className="overlay-header">
                <div className="title-wrap">
                    <h1>Blunday</h1>
                    <span className="splash" aria-hidden="true">{splash}</span>
                </div>
                <p>{isMobile ? 'Hold screen sides to move' : 'Arrow keys or A/D to move'}</p>
            </div>
            <div className="menu-buttons">
                <button onClick={onPlay}>Play</button>
                <button onClick={onUpgrades}>Upgrades</button>
                <button onClick={onAchievements}>Achievements</button>
            </div>
            <span className="version-label">RC6</span>
        </div>
    );
}
