import { useState } from 'react';
import { randomSplash } from '../game/splashes.js';
import { isMobile } from '../game/device.js';
import { version } from '../../package.json';
import MenuEmblem from './MenuEmblem.jsx';

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
                <button className="emblem-button" onClick={onPlay}><MenuEmblem icon="play" />Play</button>
                <button className="emblem-button" onClick={onUpgrades}><MenuEmblem icon="upgrades" />Upgrades</button>
                <button className="emblem-button" onClick={onAchievements}><MenuEmblem icon="trophy" />Achievements</button>
            </div>
            <span className="version-label">v{version}</span>
        </div>
    );
}
