import MenuEmblem from './MenuEmblem.jsx';

// Shown when a fall would end the run and the run's one ad revive is still
// available (Android app only): watch an ad to be saved by the Ctrl+Z Jetpack,
// or give up and go to the game over screen.
export default function ReviveOverlay({ score, watching, onWatch, onDecline }) {
    return (
        <div className="overlay gameover-overlay revive-overlay">
            <div className="overlay-header">
                <h1 className="fancy-heading gameover-heading">Second Chance?</h1>
                <p className="score-lines">Score: {score}</p>
            </div>
            <div className="menu-buttons">
                <button className="emblem-button reward-button" onClick={onWatch} disabled={watching}>
                    <MenuEmblem icon="video" />
                    <span className="reward-label">
                        {watching ? 'Loading ad…' : 'Watch ad: revive'}
                        <span className="reward-amount">Ctrl+Z Jetpack</span>
                    </span>
                </button>
                <button className="emblem-button" onClick={onDecline} disabled={watching}><MenuEmblem icon="home" />No thanks</button>
            </div>
        </div>
    );
}
