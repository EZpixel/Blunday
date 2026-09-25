import AchievementIcon from './AchievementIcon.jsx';

export default function EffectBar({ effects }) {
    if (!effects || effects.length === 0) return null;
    const labels = { jetpack: 'Jetpack', boots: 'Boots', umbrella: 'Umbrella', star: 'Star' };
    return (
        <div className="effect-bar-stack">
            {effects.map(e => {
                const pct   = Math.max(0, (e.remaining / e.total) * 100);
                const label = labels[e.type] ?? e.type;
                return (
                    <div className="effect-bar-wrapper" key={e.type}>
                        <span className="effect-bar-icon" title={label} aria-label={label}>
                            <AchievementIcon icon={e.type} size={18} />
                        </span>
                        <div className="effect-bar-track">
                            <div className={`effect-bar-fill ${e.type}`} style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
