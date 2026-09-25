export default function GoldIcon({ size = 14 }) {
    return (
        <svg className="gold-icon" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Gold">
            <title>Gold</title>
            <circle cx="12" cy="12" r="11" fill="#b8860b" />
            <circle cx="12" cy="12" r="9" fill="#ffd700" />
            <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#b8860b">$</text>
        </svg>
    );
}
