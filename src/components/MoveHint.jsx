import { useEffect, useState } from 'react';
import { isMobile } from '../game/device.js';

const FADE_MS = 400;

const LABELS = isMobile
    ? { left: 'Hold to move left', right: 'Hold to move right' }
    : { left: 'Use ← or A',   right: 'Use → or D' };

// Pulsing left/right arrows shown to first-time players. Stays mounted briefly
// after `visible` turns off so it can fade out instead of vanishing mid-jump.
export default function MoveHint({ visible }) {
    const [mounted, setMounted] = useState(visible);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            return;
        }
        const t = setTimeout(() => setMounted(false), FADE_MS);
        return () => clearTimeout(t);
    }, [visible]);

    if (!mounted) return null;
    return (
        <div className={`move-hint${visible ? '' : ' hidden'}`} aria-hidden="true">
            <div className="move-hint-side left">
                <span className="move-hint-arrow">{'◀︎'}</span>
                <span className="move-hint-label">{LABELS.left}</span>
            </div>
            <div className="move-hint-side right">
                <span className="move-hint-arrow">{'▶︎'}</span>
                <span className="move-hint-label">{LABELS.right}</span>
            </div>
        </div>
    );
}
