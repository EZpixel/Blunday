import MenuEmblem from './MenuEmblem.jsx';

// Google Play Games' icon (a Google trademark: shown unaltered, only next to Play
// Games features), saved as src/assets/brand/Google_Play_Games_Logo.svg. It is
// picked up at build time if it's there; otherwise the game's own trophy
// emblem stands in.
const files = import.meta.glob('../assets/brand/Google_Play_Games_Logo.{svg,png}', { eager: true, import: 'default' });
const logoUrl = Object.values(files)[0] || null;

export default function PlayGamesLogo({ size = 28, className = '' }) {
    if (!logoUrl) return <MenuEmblem icon="trophy" className={className} />;
    return (
        <img
            className={`play-games-logo ${className}`}
            src={logoUrl}
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            draggable="false"
        />
    );
}
