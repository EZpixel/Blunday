import { getAll } from '../game/achievements.js';
import AchievementIcon from './AchievementIcon.jsx';
import BackButton from './BackButton.jsx';

export default function AchievementsView({ onBack }) {
    const achievements = getAll();

    return (
        <div className="overlay list-overlay">
            <h1>Achievements</h1>
            <ul className="achievements-list">
                {achievements.map(a => (
                    <li key={a.id} className={'achievement ' + (a.unlocked ? 'unlocked' : 'locked')}>
                        <div className="achievement-title-row">
                            <AchievementIcon icon={a.icon} />
                            <strong>{a.title}</strong>
                        </div>
                        <span>{a.description}</span>
                    </li>
                ))}
            </ul>
            <BackButton onClick={onBack} />
        </div>
    );
}
