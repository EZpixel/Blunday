import { useEffect, useState } from 'react';

// Safari (including iPadOS) still only ships the webkit-prefixed Fullscreen API.
// iPhone Safari has none for regular elements, so the button hides itself there.
const fullscreenSupported = typeof document !== 'undefined'
    && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
    if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
        const root = document.documentElement;
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        // Promise-returning in modern browsers; ignore rejections (e.g. denied by the browser)
        request.call(root)?.catch?.(() => {});
    }
}

function FullscreenIcon({ active }) {
    // Four corner brackets: pointing out to expand, pointing in to shrink
    const d = active
        ? 'M8 3 V8 H3 M16 3 V8 H21 M8 21 V16 H3 M16 21 V16 H21'
        : 'M3 8 V3 H8 M21 8 V3 H16 M3 16 V21 H8 M21 16 V21 H16';
    return (
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function FullscreenButton() {
    const [active, setActive] = useState(() => fullscreenSupported && isFullscreen());

    // Track changes made outside the button too (Esc key, browser UI, back gesture)
    useEffect(() => {
        if (!fullscreenSupported) return;
        const onChange = () => setActive(isFullscreen());
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    if (!fullscreenSupported) return null;
    const label = active ? 'Exit full screen' : 'Full screen';
    return (
        <button className="fullscreen-toggle" onClick={toggleFullscreen} aria-label={label} title={label}>
            <FullscreenIcon active={active} />
        </button>
    );
}
