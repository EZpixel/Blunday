import MenuEmblem from './MenuEmblem.jsx';

export default function SettingsButton({ onClick }) {
    return (
        <button className="settings-gear" onClick={onClick} aria-label="Settings" title="Settings">
            <MenuEmblem icon="gear" className="emblem-large" />
        </button>
    );
}
