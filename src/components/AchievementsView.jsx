import { getAll } from '../game/achievements.js';
import BadgeArt from './BadgeArt.jsx';
import { achievementArt } from '../game/badgeArt.js';
import BackButton from './BackButton.jsx';

export default function AchievementsView({ onBack }) {
    const achievements = getAll();

    return (
        <div className="overlay list-overlay">
            <h1 className="fancy-heading achievements-heading">Achievements</h1>
            <ul className="achievements-list">
                {achievements.map(a => (
                    <li key={a.id} className={'achievement ' + (a.unlocked ? 'unlocked' : 'locked')}>
                        <BadgeArt src={achievementArt(a.id)} size={48} />
                        <div className="achievement-text">
                            <strong>{a.title}</strong>
                            <span>{a.description}</span>
                        </div>
                    </li>
                ))}
            </ul>
            <BackButton onClick={onBack} />
        </div>
    );
}
