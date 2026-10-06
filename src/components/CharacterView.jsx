import { useState } from 'react';
import { TABS, SLOT_LABELS, TOTAL_ITEMS, itemsForSlot, isItemUnlocked, unlockHint, equip, toggleEmote, randomizeLook, countUnlocked, findItem } from '../game/wardrobe.js';
import BackButton from './BackButton.jsx';
import BlundayPortrait from './BlundayPortrait.jsx';
import useLook from './useLook.js';

function LockIcon() {
    return (
        <svg className="wardrobe-lock" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 9 V6.5 A4 4 0 0 1 14 6.5 V9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="4" y="8.5" width="12" height="9" rx="2" fill="currentColor" />
            <circle cx="10" cy="13" r="1.6" fill="#0d1640" />
        </svg>
    );
}

function DiceIcon() {
    return (
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <rect x="2.5" y="2.5" width="15" height="15" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            {[[7, 7], [13, 13], [13, 7], [7, 13], [10, 10]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="currentColor" />)}
        </svg>
    );
}

// What the line under the tabs says about an item
function describe(item, emoteOn) {
    if (!item) return { text: 'None', sub: 'Keeping it simple.' };
    if (isItemUnlocked(item)) {
        if (emoteOn === undefined) return { text: item.name };
        return { text: item.name, sub: emoteOn ? 'On: Blunday feels this now and then.' : 'Off: tap to turn it on.' };
    }
    const hint = unlockHint(item);
    if (hint.kind === 'achievement') return { text: item.name, sub: <>Unlock with <em>{hint.title}</em></>, locked: true };
    return { text: item.name, sub: 'Coming soon. Rumor has it there\'s a shop.', locked: true };
}

export default function CharacterView({ onBack }) {
    const look = useLook();
    const [tab, setTab] = useState('color');
    const [info, setInfo] = useState(null); // what the last tapped tile says

    const isEmotes = tab === 'emotes';
    const items = itemsForSlot(tab);
    // Accessory slots start with None, which is always available. Emotes are
    // switched on and off one by one, any number at once.
    const tiles = tab === 'color' || isEmotes ? items : [null, ...items];
    const equippedItem = isEmotes ? null : look[tab] ? findItem(tab, look[tab]) : null;
    const emotesOn = look.emotes.length;
    const message = info || (isEmotes
        ? { text: `${emotesOn} emote${emotesOn === 1 ? '' : 's'} on`, sub: 'Equip as many as you like. They show up now and then.' }
        : describe(tab === 'color' ? findItem('color', look.color) : equippedItem));

    function isEquipped(id) {
        return isEmotes ? look.emotes.includes(id) : (look[tab] ?? null) === id;
    }

    function handleTile(item) {
        if (item && !isItemUnlocked(item)) {
            setInfo(describe(item));
            return;
        }
        if (isEmotes) {
            const on = !look.emotes.includes(item.id);
            toggleEmote(item.id);
            setInfo(describe(item, on));
            return;
        }
        equip(tab, item ? item.id : null);
        setInfo(describe(item));
    }

    function handleTab(slot) {
        setTab(slot);
        setInfo(null);
    }

    return (
        <div className="overlay list-overlay character-overlay">
            <h1 className="fancy-heading character-heading">Character</h1>

            <div className="character-stage">
                <BlundayPortrait look={look} size={150} animate className="character-preview" />
                <div className="character-stage-side">
                    <p className="character-count"><strong>{countUnlocked()}</strong> / {TOTAL_ITEMS} unlocked</p>
                    <button className="character-randomize" onClick={() => { randomizeLook(); setInfo(null); }}>
                        <DiceIcon />Randomize
                    </button>
                </div>
            </div>

            <div className="character-tabs" role="tablist">
                {TABS.map(slot => (
                    <button
                        key={slot}
                        role="tab"
                        aria-selected={tab === slot}
                        className={tab === slot ? 'active' : ''}
                        onClick={() => handleTab(slot)}
                    >
                        {SLOT_LABELS[slot]}
                    </button>
                ))}
            </div>

            <p className={`character-info${message.locked ? ' locked' : ''}`} aria-live="polite">
                <strong>{message.text}</strong>
                {message.sub && <span>{message.sub}</span>}
            </p>

            <ul className="wardrobe-grid" role="tabpanel">
                {tiles.map(item => {
                    const id = item ? item.id : null;
                    const unlocked = isItemUnlocked(item);
                    const equipped = isEquipped(id);
                    const preview = isEmotes ? look : { ...look, [tab]: id };
                    return (
                        <li key={id ?? 'none'}>
                            <button
                                className={`wardrobe-tile${unlocked ? '' : ' locked'}${equipped ? ' equipped' : ''}`}
                                aria-pressed={equipped}
                                aria-label={`${item ? item.name : 'None'}${unlocked ? '' : ' (locked)'}`}
                                onClick={() => handleTile(item)}
                            >
                                <BlundayPortrait look={preview} size={62} emote={isEmotes ? id : null} />
                                <span className="wardrobe-name">{item ? item.name : 'None'}</span>
                                {!unlocked && <LockIcon />}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <BackButton onClick={onBack} />
        </div>
    );
}
