export default function GameOverOverlay({ score, highScore, onRestart, onMenu, onUpgrades }) {
    return (
        <div className="overlay gameover-overlay">
            <div className="overlay-header">
                <h1 className="fancy-heading gameover-heading">Game Over</h1>
                <p className="score-lines">
                    Score: {score} &nbsp;|&nbsp; Best: {highScore}
                </p>
            </div>
            <div className="menu-buttons">
                <button onClick={onRestart}>Restart</button>
                <button onClick={onUpgrades}>Upgrades</button>
                <button onClick={onMenu}>Main Menu</button>
            </div>
        </div>
    );
}
