import { useState } from 'react';
import { UPGRADES, getUpgradeDisplay, getNextCost, purchase, areAllUpgradesMaxed } from '../game/upgrades.js';
import { unlock } from '../game/achievements.js';
import { getGold } from '../game/wallet.js';
import GoldIcon from './GoldIcon.jsx';
import BackButton from './BackButton.jsx';

export default function UpgradesView({ onBack }) {
    const [, forceRefresh] = useState(0);

    function handleBuy(id) {
        if (purchase(id) && areAllUpgradesMaxed()) unlock('all_maxed');
        forceRefresh(n => n + 1);
    }

    const gold = getGold();

    return (
        <div className="overlay list-overlay">
            <h1>Upgrades</h1>
            <p className="gold-hud"><GoldIcon />{gold}</p>
            <ul className="achievements-list">
                {UPGRADES.map(u => {
                    const { tier, max, isMaxed } = getUpgradeDisplay(u.id);
                    const cost = getNextCost(u.id);
                    return (
                        <li key={u.id} className="achievement upgrade-item">
                            <div className="upgrade-header">
                                <span className="upgrade-title-row">
                                    {u.icon && <span className="upgrade-icon">{u.icon}</span>}
                                    <strong>{u.title}</strong>
                                </span>
                                {isMaxed
                                    ? <span className="fully-upgraded">Fully Upgraded</span>
                                    : <span className="upgrade-tier">{tier}/{max}</span>
                                }
                            </div>
                            <span>{u.description}</span>
                            {!isMaxed && (
                                <div className="upgrade-buy-row">
                                    <span className="upgrade-cost">Next: {cost} <GoldIcon /></span>
                                    <button
                                        data-sfx="upgrade"
                                        disabled={isMaxed || gold < cost}
                                        onClick={() => handleBuy(u.id)}
                                    >
                                        Buy
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            <BackButton onClick={onBack} />
        </div>
    );
}
