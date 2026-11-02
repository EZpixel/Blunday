import { useEffect, useRef } from 'react';
import { drawBlunday, BODY_W, FACES } from '../game/blunday.js';

// Blunday on a small canvas, for the Character screen and its button.
// The view is a square of `view` logical units around the cube; the default
// is roomy enough for the tallest hat and the widest hair.
const OVERSAMPLE = 3;    // the UI layer is scaled up on big screens; stay sharp
const EMOTE_FRAMES = 110; // how long the preview holds a mood

function startEmote(id, intensity) {
    const variants = FACES[id]?.length || 1;
    return { id, age: 0, dur: EMOTE_FRAMES, variant: Math.floor(Math.random() * variants), intensity, seed: Math.random() * 1000 };
}

// The big preview cycles through the equipped emotes now and then
function idleEmotes(look) {
    const ids = (look.emotes || []).map(id => (id === 'panic' ? 'relief' : id));
    return ids.length ? ids : ['suspicious'];
}

// emote: an emote id to show frozen mid-reaction (static portraits only)
// showcase: { key, reactions } plays those reactions right away, one after
// another, whenever key changes (animated portraits only), e.g. an emote
// that was just equipped
export default function BlundayPortrait({ look, size = 64, view = 72, animate = false, emote = null, showcase = null, className = '' }) {
    const viewLeft = (view - BODY_W) / 2;
    const viewTop = view - BODY_W - 6; // feet at the bottom, the rest above for hats
    const canvasRef = useRef(null);
    const lookRef = useRef(look);
    lookRef.current = look;
    // Reactions waiting to be shown, ahead of the idle moods
    const showcaseRef = useRef([]);
    useEffect(() => {
        if (showcase) showcaseRef.current = [...showcase.reactions];
    }, [showcase]); // a new object per request, so each one replays

    // Live preview: a gentle bounce, glances around, blinks and the odd mood
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !animate) return;
        const ctx = canvas.getContext('2d');
        const px = size * OVERSAMPLE;
        const scale = px / view;

        function paint(now, h, emote, blink, gaze, spin) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, px, px);
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            drawBlunday(ctx, viewLeft, viewTop + BODY_W - h, h, { look: lookRef.current, now, emote, blink, gaze, spin, gum: 0.55 });
        }

        let raf = 0;
        let emote = null;
        let nextEmote = 120 + Math.random() * 180;
        let blinkLeft = 0;
        let frame = 0;
        let spin = 0;
        function tick(now) {
            frame++;
            spin += 0.08;
            const bounce = Math.sin(now * 0.004);
            const h = BODY_W * (1 + bounce * 0.04);
            const gaze = { x: Math.sin(now * 0.0011) * 0.8, y: Math.sin(now * 0.0007) * 0.3 };
            const queued = showcaseRef.current;
            if (queued.length && !emote?.showcase) {
                // A requested reaction cuts in over any idle mood
                emote = { ...startEmote(queued.shift(), 0.9), showcase: true };
                blinkLeft = 0;
            } else {
                if (emote) {
                    if (++emote.age >= emote.dur) {
                        emote = queued.length ? { ...startEmote(queued.shift(), 0.9), showcase: true } : null;
                        nextEmote = frame + 200 + Math.random() * 300;
                    }
                } else if (frame >= nextEmote) {
                    const options = idleEmotes(lookRef.current);
                    emote = startEmote(options[Math.floor(Math.random() * options.length)], 0.6);
                }
                if (blinkLeft > 0) blinkLeft--;
                else if (Math.random() < 0.01) blinkLeft = 7;
            }
            paint(now, h, emote, blinkLeft > 0, gaze, spin);
            raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [size, view, viewLeft, viewTop, animate]);

    // A static portrait redraws whenever the look changes
    const lookKey = look ? Object.values(look).join('|') : '';
    useEffect(() => {
        if (animate) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const px = size * OVERSAMPLE;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, px, px);
        ctx.setTransform(px / view, 0, 0, px / view, 0, 0);
        const frozen = emote ? { id: emote, age: 40, dur: 100, variant: 0, intensity: 0.8, seed: 5 } : null;
        drawBlunday(ctx, viewLeft, viewTop, BODY_W, { look: lookRef.current, now: 0, gaze: { x: 0, y: 0 }, spin: 0.6, gum: 0.55, emote: frozen });
    }, [lookKey, size, view, viewLeft, viewTop, animate, emote]);

    return (
        <canvas
            ref={canvasRef}
            className={`blunday-portrait ${className}`}
            width={size * OVERSAMPLE}
            height={size * OVERSAMPLE}
            style={{ width: size, height: size }}
            aria-hidden="true"
        />
    );
}
