import BlundayPortrait from './BlundayPortrait.jsx';
import useLook from './useLook.js';

// Bottom-left twin of the settings gear: a round badge with Blunday in it,
// wearing whatever is equipped
export default function CharacterButton({ onClick }) {
    const look = useLook();
    return (
        <button className="character-button" onClick={onClick} aria-label="Character" title="Character">
            <span className="menu-emblem emblem-large character-emblem" aria-hidden="true">
                <BlundayPortrait look={look} size={50} view={58} pad={16} />
            </span>
        </button>
    );
}
