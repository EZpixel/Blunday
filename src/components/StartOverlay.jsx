import { useState } from 'react';
import { randomSplash } from '../game/splashes.js';

export default function StartOverlay({ onPlay, onAchievements, onUpgrades }) {
    const [splash] = useState(() => randomSplash());
    return (
        <div className="overlay">
            <div className="title-wrap">
                <h1>Blunday</h1>
                <span className="splash" aria-hidden="true">{splash}</span>
            </div>
            <p>Arrow keys or A/D to move</p>
            <div className="menu-buttons">
                <button onClick={onPlay}>Play</button>
                <button onClick={onUpgrades}>Upgrades</button>
                <button onClick={onAchievements}>Achievements</button>
            </div>
            <span className="version-label">RC2</span>
        </div>
    );
}
