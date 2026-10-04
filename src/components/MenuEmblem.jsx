// Round 3D badge with a simple white glyph, shown at the left of menu buttons.
// Glyphs are plain SVG shapes on a 24x24 grid; the dark outline comes from a
// wide stroke painted under the fill (paint-order: stroke).

// Gear outline: alternating tooth/root radii around a ring, with the hub cut out
function gearPath(teeth = 8, outer = 10, inner = 7.4, hole = 3.4) {
    const pts = [];
    const step = Math.PI / teeth;
    for (let i = 0; i < teeth * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        // Each tooth/gap is a short flat edge rather than a single point
        for (const a of [i * step - step * 0.3, i * step + step * 0.3]) {
            pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`);
        }
    }
    const holePath = `M${12 + hole} 12 A${hole} ${hole} 0 1 0 ${12 - hole} 12 A${hole} ${hole} 0 1 0 ${12 + hole} 12 Z`;
    return `M${pts.join(' L')} Z ${holePath}`;
}

// fill: solid shapes; line: open strokes (the trophy's handles, the restart
// arrow's arc). Both get the same dark outline.
const GLYPHS = {
    play:     { fill: 'M8.5 5.5 L18.5 12 L8.5 18.5 Z' },
    upgrades: { fill: 'M12 3.5 L19.5 11 H15 V19.5 H9 V11 H4.5 Z' },
    trophy:   {
        line: 'M6 6.2 H3.8 V8 A3.4 3.4 0 0 0 7.2 11.4 M18 6.2 H20.2 V8 A3.4 3.4 0 0 1 16.8 11.4',
        fill: 'M6.5 4 H17.5 V9 A5.5 5.5 0 0 1 6.5 9 Z M10.5 14 H13.5 V17 H16 V20 H8 V17 H10.5 Z',
    },
    restart:  { line: 'M18.2 12.5 A6.2 6.2 0 1 1 14.6 6.6', fill: 'M12.4 3.2 L19.4 5.6 L14.2 10.4 Z' },
    home:     { fill: 'M3.5 11.5 L12 4 L20.5 11.5 H18 V20 H14 V15 H10 V20 H6 V11.5 Z' },
    gear:     { fill: gearPath() },
    video:    { fill: 'M3.5 6.5 Q3.5 5 5 5 H19 Q20.5 5 20.5 6.5 V17.5 Q20.5 19 19 19 H5 Q3.5 19 3.5 17.5 Z M10 8.8 V15.2 L15.4 12 Z' },
    heart:    { fill: 'M12 20 C5.5 14.5 3 11.5 3 8.2 A4.4 4.4 0 0 1 12 6.4 A4.4 4.4 0 0 1 21 8.2 C21 11.5 18.5 14.5 12 20 Z' },
};

export default function MenuEmblem({ icon, className = '' }) {
    const { fill, line } = GLYPHS[icon];
    return (
        <span className={`menu-emblem ${className}`} aria-hidden="true">
            <svg viewBox="0 0 24 24">
                {line && <path className="emblem-line-outline" d={line} />}
                {line && <path className="emblem-line" d={line} />}
                {fill && <path className="emblem-fill" d={fill} fillRule="evenodd" />}
            </svg>
        </span>
    );
}
