import GoldIcon from './GoldIcon.jsx';

export default function ScoreHUD({ score, highScore, gold }) {
    return (
        <div className="score-hud">
            <span>Score: {score}</span>
            <span className="gold-hud"><GoldIcon />{gold ?? 0}</span>
            <span>Best: {highScore}</span>
        </div>
    );
}
