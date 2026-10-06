import { getAll } from '../game/achievements.js';
import { rewardForAchievement, isWardrobeEnabled } from '../game/wardrobe.js';
import AchievementIcon from './AchievementIcon.jsx';
import BackButton from './BackButton.jsx';

export default function AchievementsView({ onBack }) {
    const achievements = getAll();

    return (
        <div className="overlay list-overlay">
            <h1 className="fancy-heading achievements-heading">Achievements</h1>
            <ul className="achievements-list">
                {achievements.map(a => {
                    const reward = isWardrobeEnabled() ? rewardForAchievement(a.id) : null;
                    return (
                        <li key={a.id} className={'achievement ' + (a.unlocked ? 'unlocked' : 'locked')}>
                            <div className="achievement-title-row">
                                <AchievementIcon icon={a.icon} size={28} />
                                <strong>{a.title}</strong>
                            </div>
                            <span>{a.description}</span>
                            {reward && <span className="achievement-reward">Reward: {reward.name}</span>}
                        </li>
                    );
                })}
            </ul>
            <BackButton onClick={onBack} />
        </div>
    );
}
