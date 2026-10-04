import MenuEmblem from './MenuEmblem.jsx';


import GoldIcon from './GoldIcon.jsx';

// The optional "watch an ad to double this run's gold" offer (Android app only)
function DoubleGoldOffer({ offer }) {
    if (!offer) return null;
    const { state, amount, onWatch } = offer;
    if (state === 'done') {
        return <p className="reward-result">Gold doubled! +{amount} <GoldIcon /></p>;
    }
    if (state === 'closed') {
        return <p className="reward-result failed">Ad closed early, so no bonus this time.</p>;
    }
    if (state === 'failed') {
        return <p className="reward-result failed">No ad available right now. Maybe next time!</p>;
    }
    return (
        <button className="emblem-button reward-button" onClick={onWatch} disabled={state === 'watching'}>
            <MenuEmblem icon="video" />
            <span className="reward-label">
                {state === 'watching' ? 'Loading ad…' : <>Watch ad: 2x gold</>}
                <span className="reward-amount">+{amount} <GoldIcon /></span>
            </span>
        </button>
    );
}

export default function GameOverOverlay({ score, highScore, onRestart, onMenu, onUpgrades, offer }) {
    return (
        <div className="overlay gameover-overlay">
            <div className="overlay-header">
                <h1 className="fancy-heading gameover-heading">Game Over</h1>
                <p className="score-lines">
                    Score: {score} &nbsp;|&nbsp; Best: {highScore}
                </p>
                <DoubleGoldOffer offer={offer} />
            </div>
            <div className="menu-buttons">
                <button className="emblem-button" onClick={onRestart}><MenuEmblem icon="restart" />Restart</button>
                <button className="emblem-button" onClick={onUpgrades}><MenuEmblem icon="upgrades" />Upgrades</button>
                <button className="emblem-button" onClick={onMenu}><MenuEmblem icon="home" />Main Menu</button>
            </div>
        </div>
    );
}
