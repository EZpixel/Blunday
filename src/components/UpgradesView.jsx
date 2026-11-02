import { useEffect, useState } from 'react';
import { UPGRADES, getUpgradeDisplay, getNextCost, purchase, areAllUpgradesMaxed } from '../game/upgrades.js';
import { unlock } from '../game/achievements.js';
import { getGold } from '../game/wallet.js';
import { upgradeArt } from '../game/badgeArt.js';
import { formatGold } from '../game/format.js';
import GoldIcon from './GoldIcon.jsx';
import BadgeArt from './BadgeArt.jsx';
import BackButton from './BackButton.jsx';

// How long the purchase celebration runs (matches the longest animation in index.css)
const BOUGHT_MS = 1100;
const SPARKS = 6;

let boughtSeq = 0;

export default function UpgradesView({ onBack }) {
    const [, forceRefresh] = useState(0);
    // The last purchase, celebrated on its row: { id, key, cost, tier, maxed }
    const [bought, setBought] = useState(null);

    useEffect(() => {
        if (!bought) return;
        const t = setTimeout(() => setBought(null), BOUGHT_MS);
        return () => clearTimeout(t);
    }, [bought]);

    function handleBuy(id) {
        const cost = getNextCost(id);
        if (purchase(id)) {
            const { tier, isMaxed } = getUpgradeDisplay(id);
            setBought({ id, key: ++boughtSeq, cost, tier, maxed: isMaxed });
            if (areAllUpgradesMaxed()) unlock('all_maxed');
        }
        forceRefresh(n => n + 1);
    }

    const gold = getGold();

    return (
        <div className="overlay list-overlay">
            <h1 className="fancy-heading upgrades-heading">Upgrades</h1>
            <p className="gold-hud"><GoldIcon />{formatGold(gold)}</p>
            <ul className="achievements-list">
                {UPGRADES.map(u => {
                    const { tier, max, isMaxed } = getUpgradeDisplay(u.id);
                    const cost = getNextCost(u.id);
                    const fx = bought?.id === u.id ? bought : null;
                    return (
                        <li key={u.id} className={'achievement upgrade-item' + (isMaxed ? ' maxed' : '') + (fx?.maxed ? ' just-maxed' : '')}>
                            {/* Re-keyed on every purchase so the animations replay. Keys must stay
                                unique among the row's children (badge-, spent-), or React
                                leaves stale copies behind. */}
                            <span key={fx ? `badge-${fx.key}` : 'badge'} className={'upgrade-badge' + (fx ? ' just-bought' : '')}>
                                <BadgeArt src={upgradeArt(u.id)} size={48} />
                                {fx && Array.from({ length: SPARKS }, (_, i) => (
                                    <span key={i} className="upgrade-spark" style={{ '--angle': `${(360 / SPARKS) * i + 15}deg` }} />
                                ))}
                            </span>
                            <div className="upgrade-body">
                                <div className="upgrade-header">
                                    <strong>{u.title}</strong>
                                    <span className="upgrade-pips" aria-label={`Tier ${tier} of ${max}`}>
                                        {Array.from({ length: max }, (_, i) => (
                                            <span
                                                key={i}
                                                className={'upgrade-pip' + (i < tier ? ' filled' : '') + (fx && i === fx.tier - 1 ? ' new' : '')}
                                            />
                                        ))}
                                    </span>
                                </div>
                                <span>{u.description}</span>
                                {isMaxed
                                    ? <span key={fx?.maxed ? fx.key : 'maxed'} className={'fully-upgraded' + (fx?.maxed ? ' just-maxed' : '')}>Fully Upgraded</span>
                                    : (
                                        <div className="upgrade-buy-row">
                                            <span className="upgrade-cost">{formatGold(cost)} <GoldIcon /></span>
                                            <button
                                                data-sfx="upgrade"
                                                disabled={gold < cost}
                                                onClick={() => handleBuy(u.id)}
                                            >
                                                Buy
                                            </button>
                                        </div>
                                    )}
                            </div>
                            {fx && <span key={`spent-${fx.key}`} className="upgrade-spent">-{formatGold(fx.cost)} <GoldIcon /></span>}
                        </li>
                    );
                })}
            </ul>
            <BackButton onClick={onBack} />
        </div>
    );
}
