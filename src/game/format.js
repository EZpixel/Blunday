// Gold amounts: from 10 000 up, thousands are grouped with a space
// (10000 → "10 000", 250000 → "250 000"); smaller amounts stay as they are
// ("9999"). The space is non-breaking, so an amount never wraps onto two lines.
export function formatGold(amount) {
    const n = Math.floor(amount ?? 0);
    if (Math.abs(n) < 10000) return String(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
