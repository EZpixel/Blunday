// An illustrated badge (achievement or upgrade art from badgeArt.js). Locked
// achievements are greyed out by CSS.
export default function BadgeArt({ src, size = 44, className = '' }) {
    if (!src) return null;
    return <img className={'badge-art ' + className} src={src} width={size} height={size} alt="" draggable={false} />;
}
