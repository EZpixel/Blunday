import { getColor, findItem } from './wardrobe.js';

// Draws Blunday: body, face (with the current emote), then the accessories in
// a fixed order, back to front: body → face → glasses → hair → hat, and the
// emote's little effects last. Shared by the game, the title screen cameos,
// the Character screen and its button, so the look is the same everywhere.
//
// Everything is in the game's logical units. (x, y) is the body's top left,
// h its current (squashed or stretched) height; the width is always BODY_W.
// Face features keep fixed offsets from the top, as the original face did, so
// accessories line up with them at any stretch.
export const BODY_W = 40;

const EYE_L = 8;      // left eye box x (9x9)
const EYE_R = 23;     // right eye box x
const EYE_Y = 10;     // eye box top
const EYE_S = 9;
const MOUTH_Y = 25;   // mouth center line
const CX = BODY_W / 2;

// ─── Faces ──────────────────────────────────────────────────────────────────
// Each emote is a pair of eyes and a mouth, plus an optional effect. Some have
// variants (picked at random when the emote starts) so they don't repeat.
export const FACES = {
    smile:     [{ eyes: 'normal',  mouth: 'smile' },  { eyes: 'happy', mouth: 'smile' }],
    tongue:    [{ eyes: 'wink',    mouth: 'tongue' }, { eyes: 'squint', mouth: 'tongue' }],
    shocked:   [{ eyes: 'wide',    mouth: 'O', fx: 'sparkle' }],
    money:     [{ eyes: 'money',   mouth: 'grin', fx: 'coins' }],
    proud:     [{ eyes: 'happy',   mouth: 'smile', fx: 'sparkle' }, { eyes: 'normal', mouth: 'smirk', fx: 'sparkle' }],
    relief:    [{ eyes: 'happy',   mouth: 'smile', fx: 'sweat' }, { eyes: 'closed', mouth: 'smile', fx: 'sweat' }],
    thrust:    [{ eyes: 'wide',    mouth: 'O', fx: 'exclaim' }],
    sproing:   [{ eyes: 'star',    mouth: 'grin' }, { eyes: 'happy', mouth: 'grin', fx: 'boing' }],
    dizzy:     [{ eyes: 'swirl',   mouth: 'wavy', fx: 'dizzy' }],
    annoyed:   [{ eyes: 'flat',    mouth: 'frown', fx: 'vein' }, { eyes: 'wide', mouth: 'flat', fx: 'exclaim' }],
    poppins:   [{ eyes: 'content', mouth: 'smirk', fx: 'note' }],
    panic:     [{ eyes: 'tiny',    mouth: 'scream', fx: 'sweat' }],
    houston:   [{ eyes: 'determined', mouth: 'grit' }, { eyes: 'determined', mouth: 'grin' }],
    celebrate: [{ eyes: 'happy',   mouth: 'grin', fx: 'confetti' }, { eyes: 'heart', mouth: 'grin', fx: 'hearts' }],
    sleepy:    [{ eyes: 'half',    mouth: 'yawn', fx: 'zzz' }],
    suspicious:[{ eyes: 'squint',  mouth: 'flat' }],
    blink:     [{ eyes: 'closed',  mouth: 'line' }],
};

const NEUTRAL = { eyes: 'normal', mouth: 'line' };

// Eyes that are a big part of the reaction: dark shades slip down for these
const STRONG_EYES = new Set(['wide', 'tiny', 'money', 'swirl', 'star', 'heart']);
// Open mouths: no gum bubble while the mouth is busy
const OPEN_MOUTHS = new Set(['O', 'scream', 'yawn', 'grin', 'tongue', 'grit']);

export function faceFor(emote) {
    if (!emote) return NEUTRAL;
    const variants = FACES[emote.id];
    if (!variants) return NEUTRAL;
    return variants[(emote.variant || 0) % variants.length];
}

// 0 → 1 → 0 envelope over an emote's life: quick in, hold, fade out
function envelope(t) {
    if (t < 0.12) return t / 0.12;
    if (t > 0.8) return Math.max(0, (1 - t) / 0.2);
    return 1;
}

// ─── Body ───────────────────────────────────────────────────────────────────
function drawBody(ctx, x, y, h, color, now, outline) {
    const grad = ctx.createLinearGradient(x, y, x + BODY_W, y + h);
    grad.addColorStop(0, color.light);
    grad.addColorStop(1, color.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, BODY_W, h, 6);
    ctx.fill();
    if (outline) {
        ctx.strokeStyle = outline;
        ctx.lineWidth   = 2.5;
        ctx.stroke();
    }

    // Soft top highlight and bottom shade, so every color reads as a cube and
    // not a flat sticker
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 2.5, BODY_W - 14, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + h - 5, BODY_W - 6, 3, 1.5);
    ctx.fill();

    // Gold catches the light: a glint sweeps across now and then
    if (color.shiny) {
        const phase = (now * 0.0004) % 1;
        if (phase < 0.35) {
            const gx = x - 10 + (phase / 0.35) * (BODY_W + 20);
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, BODY_W, h, 6);
            ctx.clip();
            ctx.fillStyle = 'rgba(255,255,240,0.45)';
            ctx.beginPath();
            ctx.moveTo(gx, y);
            ctx.lineTo(gx + 6, y);
            ctx.lineTo(gx - 4, y + h);
            ctx.lineTo(gx - 10, y + h);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

function drawFeet(ctx, x, y, h, color) {
    ctx.fillStyle = color.dark;
    ctx.fillRect(x + 4, y + h - 2, 10, 6);
    ctx.fillRect(x + BODY_W - 14, y + h - 2, 10, 6);
}

// ─── Eyes ───────────────────────────────────────────────────────────────────
function eyeWhite(ctx, ex, ey, color, grow = 0) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(ex - grow, ey - grow, EYE_S + grow * 2, EYE_S + grow * 2);
    // Pale bodies would swallow the whites, so they get a thin outline
    if (color.paleEyes) {
        ctx.strokeStyle = color.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(ex - grow + 0.5, ey - grow + 0.5, EYE_S + grow * 2 - 1, EYE_S + grow * 2 - 1);
    }
}

function pupil(ctx, ex, ey, gaze, size = 4) {
    const range = (EYE_S - size) / 2;
    ctx.fillStyle = '#111';
    ctx.fillRect(ex + range + gaze.x * range, ey + range + gaze.y * range, size, size);
}

function strokeEyeLine(ctx, color, path) {
    ctx.strokeStyle = color.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path();
    ctx.stroke();
}

function miniStar(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
}

function miniHeart(ctx, cx, cy, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
    ctx.fill();
}

function drawEye(ctx, kind, ex, ey, side, color, gaze, now) {
    const cx = ex + EYE_S / 2;
    const cy = ey + EYE_S / 2;
    switch (kind) {
        case 'closed':
            strokeEyeLine(ctx, color, () => { ctx.moveTo(ex + 1, cy + 1); ctx.lineTo(ex + EYE_S - 1, cy + 1); });
            return;
        case 'happy': // ^ ^
            strokeEyeLine(ctx, color, () => { ctx.moveTo(ex + 1, cy + 2); ctx.lineTo(cx, cy - 2); ctx.lineTo(ex + EYE_S - 1, cy + 2); });
            return;
        case 'content': // calm, closed, smiling eyes
            strokeEyeLine(ctx, color, () => { ctx.arc(cx, cy - 1, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); });
            return;
        case 'wink':
            if (side > 0) {
                strokeEyeLine(ctx, color, () => { ctx.moveTo(ex + 1, cy + 2); ctx.lineTo(cx, cy - 2); ctx.lineTo(ex + EYE_S - 1, cy + 2); });
            } else {
                eyeWhite(ctx, ex, ey, color);
                pupil(ctx, ex, ey, gaze);
            }
            return;
        case 'wide':
            eyeWhite(ctx, ex, ey, color, 1);
            pupil(ctx, ex, ey, { x: 0, y: 0 }, 3);
            return;
        case 'tiny': // panic: huge whites, pinprick pupils that tremble
            eyeWhite(ctx, ex, ey, color, 1.5);
            pupil(ctx, ex, ey, { x: Math.sin(now * 0.09 + side) * 0.5, y: 0.3 }, 2);
            return;
        case 'squint':
        case 'flat':
        case 'half': {
            // Lids over the top of the eye in the body color
            const lid = kind === 'half' ? 5 : kind === 'flat' ? 4 : 3.5;
            eyeWhite(ctx, ex, ey, color);
            // Squinting eyes follow the gaze (the title cameo eyes the Play button)
            const look = kind === 'squint' ? { x: gaze.x, y: Math.max(gaze.y, 0.4) } : { x: gaze.x * 0.5, y: 1 };
            pupil(ctx, ex, ey, look);
            ctx.fillStyle = color.dark;
            ctx.fillRect(ex - 0.5, ey - 0.5, EYE_S + 1, lid + 0.5);
            ctx.fillStyle = color.ink;
            ctx.fillRect(ex - 0.5, ey + lid - 0.5, EYE_S + 1, 1.5);
            return;
        }
        case 'money':
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = '#9a6a00';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', cx, cy + 0.5);
            return;
        case 'swirl': {
            eyeWhite(ctx, ex, ey, color);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            const spin = now * 0.012 * side;
            for (let i = 0; i <= 24; i++) {
                const a = spin + i * 0.55;
                const r = i * 0.17;
                ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            ctx.stroke();
            return;
        }
        case 'star':
            miniStar(ctx, cx, cy, 5.5 + 0.6 * Math.sin(now * 0.02), '#ffe14a');
            return;
        case 'heart':
            miniHeart(ctx, cx, cy, 4.2 + 0.5 * Math.sin(now * 0.015), '#ff4d7d');
            return;
        case 'determined':
            eyeWhite(ctx, ex, ey, color);
            pupil(ctx, ex, ey, { x: 0, y: -0.6 });
            // Brows slanting down toward the middle
            strokeEyeLine(ctx, color, () => {
                const inner = side < 0 ? ex + EYE_S : ex;
                const outer = side < 0 ? ex : ex + EYE_S;
                ctx.moveTo(outer, ey - 3.5);
                ctx.lineTo(inner, ey - 0.5);
            });
            return;
        default: // normal
            eyeWhite(ctx, ex, ey, color);
            pupil(ctx, ex, ey, gaze);
    }
}

// ─── Mouths ─────────────────────────────────────────────────────────────────
function drawMouth(ctx, kind, x, y, color, now, t, intensity) {
    const mx = x + CX;
    const my = y + MOUTH_Y;
    ctx.strokeStyle = color.ink;
    ctx.fillStyle = color.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    switch (kind) {
        case 'smile':
            ctx.beginPath();
            ctx.arc(mx, my - 5, 6.5, 0.22 * Math.PI, 0.78 * Math.PI);
            ctx.stroke();
            return;
        case 'smirk':
            ctx.beginPath();
            ctx.moveTo(mx - 5, my);
            ctx.quadraticCurveTo(mx + 2, my + 2, mx + 6, my - 2);
            ctx.stroke();
            return;
        case 'grin': // open smile with a tongue
            ctx.beginPath();
            ctx.moveTo(mx - 7, my - 2);
            ctx.lineTo(mx + 7, my - 2);
            ctx.arc(mx, my - 2, 7, 0, Math.PI);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ff7a8a';
            ctx.beginPath();
            ctx.ellipse(mx, my + 2.6, 3.6, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        case 'O': {
            const r = 2.4 + 1.8 * intensity;
            ctx.beginPath();
            ctx.ellipse(mx, my + 0.5, r * 0.8, r, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        case 'scream': {
            const wobble = Math.sin(now * 0.05) * 0.6;
            ctx.beginPath();
            ctx.ellipse(mx, my + 1, 4 + wobble, 4.5 - wobble, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        case 'tongue':
            ctx.beginPath();
            ctx.arc(mx, my - 4, 5.5, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
            ctx.fillStyle = '#ff6f87';
            ctx.beginPath();
            ctx.roundRect(mx - 0.5, my + 0.5, 5, 5 + Math.sin(now * 0.02), [0, 0, 2.5, 2.5]);
            ctx.fill();
            ctx.strokeStyle = '#c23a55';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(mx + 2, my + 1);
            ctx.lineTo(mx + 2, my + 4);
            ctx.stroke();
            return;
        case 'wavy':
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) {
                ctx.lineTo(mx - 7 + i * 1.75, my + (i % 2 === 0 ? -1 : 1.2));
            }
            ctx.stroke();
            return;
        case 'frown':
            ctx.beginPath();
            ctx.arc(mx, my + 5, 6, 1.22 * Math.PI, 1.78 * Math.PI);
            ctx.stroke();
            return;
        case 'flat':
            ctx.fillRect(mx - 2, my - 1, 9, 2);
            return;
        case 'grit':
            ctx.fillStyle = '#fff';
            ctx.fillRect(mx - 7, my - 2.5, 14, 5);
            ctx.lineWidth = 1.2;
            ctx.strokeRect(mx - 7, my - 2.5, 14, 5);
            ctx.beginPath();
            ctx.moveTo(mx - 7, my);
            ctx.lineTo(mx + 7, my);
            ctx.stroke();
            return;
        case 'yawn': {
            const open = Math.sin(Math.min(t * 1.6, 1) * Math.PI); // one big yawn
            ctx.beginPath();
            ctx.ellipse(mx, my + 1, 3 + open * 1.5, 1 + open * 4, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        default: // line, like the original face
            ctx.fillRect(x + 13, y + 24, 14, 2);
    }
}

// ─── Face accessories ───────────────────────────────────────────────────────
// Between the eyes (bottom at 19) and the mouth (24..26)
function drawFaceItem(ctx, id, x, y, mouthOpen, gum) {
    const mx = x + CX;
    switch (id) {
        case 'handlebar': {
            ctx.fillStyle = '#3b2412';
            ctx.beginPath();
            ctx.moveTo(mx, y + 20.5);
            ctx.bezierCurveTo(mx - 5, y + 19, mx - 9, y + 22.5, mx - 11, y + 21);
            ctx.bezierCurveTo(mx - 14, y + 19, mx - 13, y + 16, mx - 11, y + 17);
            ctx.bezierCurveTo(mx - 12.5, y + 18.5, mx - 11, y + 20, mx - 9.5, y + 19.5);
            ctx.bezierCurveTo(mx - 6, y + 18, mx - 3, y + 18.5, mx, y + 19.5);
            ctx.bezierCurveTo(mx + 3, y + 18.5, mx + 6, y + 18, mx + 9.5, y + 19.5);
            ctx.bezierCurveTo(mx + 11, y + 20, mx + 12.5, y + 18.5, mx + 11, y + 17);
            ctx.bezierCurveTo(mx + 13, y + 16, mx + 14, y + 19, mx + 11, y + 21);
            ctx.bezierCurveTo(mx + 9, y + 22.5, mx + 5, y + 19, mx, y + 20.5);
            ctx.fill();
            return;
        }
        case 'pencil':
            // Thin, with the tips flicked up: suave, slightly suspicious
            ctx.strokeStyle = '#1e120a';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mx - 8, y + 20.5);
            ctx.quadraticCurveTo(mx - 4, y + 22.5, mx - 0.8, y + 21.5);
            ctx.moveTo(mx + 8, y + 20.5);
            ctx.quadraticCurveTo(mx + 4, y + 22.5, mx + 0.8, y + 21.5);
            ctx.stroke();
            return;
        case 'walrus': {
            ctx.fillStyle = '#d8d2c4';
            ctx.strokeStyle = '#9a9282';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(mx - 9, y + 25.5);
            ctx.quadraticCurveTo(mx - 10, y + 19, mx, y + 19.5);
            ctx.quadraticCurveTo(mx + 10, y + 19, mx + 9, y + 25.5);
            // Bristly fringe, stopping just short of the mouth's middle
            for (let i = 4; i >= -4; i--) ctx.lineTo(mx + i * 2, y + (i % 2 === 0 ? 23.5 : 22.5));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;
        }
        case 'goatee':
            ctx.fillStyle = '#3b2412';
            ctx.beginPath();
            ctx.moveTo(mx - 3.5, y + 28);
            ctx.lineTo(mx + 3.5, y + 28);
            ctx.lineTo(mx + 1.5, y + 33);
            ctx.lineTo(mx, y + 34.5);
            ctx.lineTo(mx - 1.5, y + 33);
            ctx.closePath();
            ctx.fill();
            // and a little soul patch of mustache
            ctx.fillRect(mx - 6, y + 21.2, 12, 1.6);
            return;
        case 'gum': {
            if (mouthOpen || gum <= 0.05) return;
            const r = 1.5 + gum * 6.5;
            ctx.fillStyle = 'rgba(255,140,200,0.92)';
            ctx.beginPath();
            ctx.arc(mx + 1, y + MOUTH_Y + r * 0.35, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.beginPath();
            ctx.arc(mx + 1 - r * 0.35, y + MOUTH_Y - r * 0.15, r * 0.25, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        case 'rosy':
            ctx.fillStyle = 'rgba(255,110,140,0.55)';
            ctx.beginPath();
            ctx.ellipse(x + 7, y + 22.5, 3.5, 2, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 33, y + 22.5, 3.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
    }
}

// ─── Glasses ────────────────────────────────────────────────────────────────
// Lenses sit over the eye boxes (x 8..17 and 23..32, y 10..19). Clear lenses
// are tinted only lightly, so the emote's eyes still read through them.
function lensPath(ctx, shape, cx, cy, r) {
    if (shape === 'star') {
        for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const rr = i % 2 === 0 ? r : r * 0.55;
            ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.closePath();
    } else if (shape === 'heart') {
        const s = r * 0.85;
        ctx.moveTo(cx, cy + s);
        ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.65, cy - s * 1.25, cx, cy - s * 0.4);
        ctx.bezierCurveTo(cx + s * 0.65, cy - s * 1.25, cx + s * 1.5, cy - s * 0.1, cx, cy + s);
        ctx.closePath();
    }
}

function drawGlasses(ctx, id, x, y) {
    const lx = x + EYE_L + EYE_S / 2;
    const rx = x + EYE_R + EYE_S / 2;
    const ey = y + EYE_Y + EYE_S / 2;
    switch (id) {
        case 'dealwithit': {
            // Pixel shades: chunky black lenses with stepped bottoms
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x + 5, y + 11, 30, 2.5);      // top bar across both
            for (const ox of [x + 6, x + 22]) {
                ctx.fillRect(ox, y + 13, 12, 3);
                ctx.fillRect(ox + 1.5, y + 16, 9, 2);
                ctx.fillRect(ox + 3, y + 18, 6, 1.5);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            for (const ox of [x + 8, x + 24]) {
                ctx.fillRect(ox, y + 13.5, 2, 2);
                ctx.fillRect(ox + 2.5, y + 15.5, 1.5, 1.5);
            }
            return;
        }
        case 'starshades':
        case 'heart': {
            const shape = id === 'starshades' ? 'star' : 'heart';
            const r = shape === 'star' ? 8 : 7.5;
            ctx.fillStyle = shape === 'star' ? 'rgba(255,190,40,0.28)' : 'rgba(255,80,150,0.3)';
            ctx.strokeStyle = shape === 'star' ? '#ffb000' : '#ff3d8b';
            ctx.lineWidth = 1.8;
            ctx.lineJoin = 'round';
            for (const cx of [lx, rx]) {
                ctx.beginPath();
                lensPath(ctx, shape, cx, ey, r);
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(lx + 4, ey - 1.5);
            ctx.lineTo(rx - 4, ey - 1.5);
            ctx.stroke();
            return;
        }
        case 'monocle':
            ctx.strokeStyle = '#d4a017';
            ctx.lineWidth = 1.6;
            ctx.fillStyle = 'rgba(200,230,255,0.18)';
            ctx.beginPath();
            ctx.arc(rx, ey, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Chain dangling to the side of the body
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(rx + 5, ey + 4);
            ctx.quadraticCurveTo(x + BODY_W + 1, y + 26, x + BODY_W - 2, y + 32);
            ctx.stroke();
            return;
        case 'nerd':
            ctx.strokeStyle = '#151515';
            ctx.lineWidth = 2.2;
            ctx.fillStyle = 'rgba(200,230,255,0.15)';
            for (const cx of [lx, rx]) {
                ctx.beginPath();
                ctx.roundRect(cx - 6.5, ey - 6, 13, 12, 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(lx + 6.5, ey - 1);
            ctx.lineTo(rx - 6.5, ey - 1);
            ctx.stroke();
            // Tape holding the bridge together
            ctx.fillStyle = '#f4f4ec';
            ctx.fillRect(x + CX - 2, ey - 3, 4, 4.5);
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + CX - 2, ey - 3, 4, 4.5);
            return;
        case '3d':
            ctx.fillStyle = '#f6f6f6';
            ctx.fillRect(x + 4, y + 8.5, 32, 12);
            ctx.fillStyle = 'rgba(255,40,60,0.55)';
            ctx.fillRect(lx - 5.5, ey - 4.5, 11, 9);
            ctx.fillStyle = 'rgba(40,220,255,0.55)';
            ctx.fillRect(rx - 5.5, ey - 4.5, 11, 9);
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x + 4, y + 8.5, 32, 12);
            return;
        case 'ski': {
            // Strap round the head, one big tinted lens over both eyes
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(x - 1, y + 12, BODY_W + 2, 5);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(x + 4, y + 8, 32, 13, 6);
            ctx.fill();
            const lens = ctx.createLinearGradient(x, y + 9, x, y + 20);
            lens.addColorStop(0, 'rgba(255,170,40,0.55)');
            lens.addColorStop(1, 'rgba(230,60,140,0.45)');
            ctx.fillStyle = lens;
            ctx.beginPath();
            ctx.roundRect(x + 5.5, y + 9.5, 29, 10, 5);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(x + 9, y + 11, 6, 1.5);
            return;
        }
    }
}

// The eyes drawn first are visible through clear glasses. Dark shades redraw
// nothing; during a big reaction they slip down to let the eyes peek over.
export function glassesSlip(look, face, k) {
    const item = look.glasses && findItem('glasses', look.glasses);
    return item?.dark && STRONG_EYES.has(face.eyes) ? 5 * k : 0;
}

// ─── Hair ───────────────────────────────────────────────────────────────────
// Each style has a full version and a tucked one for under a hat: sides,
// back and fringe peek out below the brim; tall styles squash flat.
const HAIR_COLORS = {
    mullet: '#7a4520', mohawk: '#ff3d9a', spiky: '#ffd23a', combover: '#3c3c44',
    fluffy: '#c0602a', bowl: '#2a1a10', single: '#1a1a1a',
};

function blob(ctx, list) {
    ctx.beginPath();
    for (const [cx, cy, r] of list) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
}

function drawHair(ctx, id, x, y, underHat, now) {
    const c = HAIR_COLORS[id];
    if (!c) return;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    switch (id) {
        case 'mullet':
            if (!underHat) {
                ctx.beginPath();
                ctx.roundRect(x + 1, y - 2.5, BODY_W - 2, 6, [5, 5, 1, 1]);
                ctx.fill();
            }
            // Business in the front, gravity in the back: long locks down both sides
            ctx.beginPath();
            ctx.moveTo(x - 2, y + 1);
            ctx.lineTo(x + 3, y + 1);
            ctx.lineTo(x + 2, y + 18);
            ctx.lineTo(x - 3, y + 22);
            ctx.closePath();
            ctx.moveTo(x + BODY_W + 2, y + 1);
            ctx.lineTo(x + BODY_W - 3, y + 1);
            ctx.lineTo(x + BODY_W - 2, y + 18);
            ctx.lineTo(x + BODY_W + 3, y + 22);
            ctx.closePath();
            ctx.fill();
            return;
        case 'mohawk':
            if (underHat) {
                // Tucked away: just a tuft out the back
                ctx.beginPath();
                ctx.moveTo(x + BODY_W - 2, y + 2);
                ctx.lineTo(x + BODY_W + 4, y - 1);
                ctx.lineTo(x + BODY_W + 2, y + 4);
                ctx.lineTo(x + BODY_W + 5, y + 6);
                ctx.lineTo(x + BODY_W - 2, y + 7);
                ctx.closePath();
                ctx.fill();
                return;
            }
            ctx.beginPath();
            ctx.moveTo(x + 13, y + 1);
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(x + 14 + i * 3, y - 11 + (i === 2 ? -2 : 0));
                ctx.lineTo(x + 15.5 + i * 3, y - 3);
            }
            ctx.lineTo(x + 28, y + 1);
            ctx.closePath();
            ctx.fill();
            return;
        case 'spiky':
            if (underHat) {
                // Spikes poking out sideways under the brim
                ctx.beginPath();
                for (const s of [-1, 1]) {
                    const ex = s < 0 ? x + 2 : x + BODY_W - 2;
                    ctx.moveTo(ex, y + 1);
                    ctx.lineTo(ex + s * 8, y + 1);
                    ctx.lineTo(ex, y + 4);
                    ctx.lineTo(ex + s * 7, y + 7);
                    ctx.lineTo(ex, y + 8);
                    ctx.closePath();
                }
                ctx.fill();
                return;
            }
            ctx.beginPath();
            ctx.moveTo(x - 2, y + 6);
            const pts = [[-6, -3], [4, -6], [8, -14], [15, -5], [20, -17], [25, -5], [32, -14], [36, -6], [46, -3], [41, 6]];
            for (const [px, py] of pts) ctx.lineTo(x + px, y + py);
            ctx.lineTo(x + BODY_W, y + 3);
            ctx.lineTo(x, y + 3);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 10, y - 8);
            ctx.lineTo(x + 13, y - 3);
            ctx.moveTo(x + 22, y - 10);
            ctx.lineTo(x + 23, y - 4);
            ctx.stroke();
            return;
        case 'combover':
            if (underHat) {
                ctx.fillRect(x + 1, y + 1, 3, 7);
                ctx.fillRect(x + BODY_W - 4, y + 1, 3, 7);
                return;
            }
            ctx.beginPath();
            ctx.moveTo(x + 2, y + 4);
            ctx.quadraticCurveTo(x + 8, y - 4, x + 36, y - 1);
            ctx.quadraticCurveTo(x + 40, y + 1, x + 38, y + 4);
            ctx.quadraticCurveTo(x + 22, y - 0.5, x + 6, y + 4.5);
            ctx.closePath();
            ctx.fill();
            // Strands that don't quite cover anything
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                ctx.moveTo(x + 7 + i * 3, y + 2.5);
                ctx.quadraticCurveTo(x + 20, y - 4 + i, x + 34, y + 0.5 + i);
            }
            ctx.stroke();
            return;
        case 'fluffy':
            if (underHat) {
                blob(ctx, [[x + 1, y + 5, 5], [x - 1, y + 10, 4], [x + BODY_W - 1, y + 5, 5], [x + BODY_W + 1, y + 10, 4]]);
                return;
            }
            blob(ctx, [
                [x + 4, y + 4, 7], [x + 36, y + 4, 7], [x + 10, y - 3, 8], [x + 20, y - 6, 9],
                [x + 30, y - 3, 8], [x + 1, y + 11, 5], [x + 39, y + 11, 5],
            ]);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            blob(ctx, [[x + 16, y - 9, 3], [x + 27, y - 6, 2.5]]);
            return;
        case 'bowl':
            ctx.beginPath();
            if (underHat) {
                // Fringe and sides below the brim
                ctx.rect(x + 1, y + 2, BODY_W - 2, 5.5);
                ctx.rect(x - 0.5, y + 2, 3.5, 9);
                ctx.rect(x + BODY_W - 3, y + 2, 3.5, 9);
                ctx.fill();
                return;
            }
            ctx.moveTo(x - 1, y + 9);
            ctx.lineTo(x - 1, y + 3);
            ctx.quadraticCurveTo(x - 1, y - 5, x + CX, y - 5);
            ctx.quadraticCurveTo(x + BODY_W + 1, y - 5, x + BODY_W + 1, y + 3);
            ctx.lineTo(x + BODY_W + 1, y + 9);
            ctx.lineTo(x + BODY_W - 3, y + 9);
            ctx.lineTo(x + BODY_W - 3, y + 7.5);
            ctx.lineTo(x + 3, y + 7.5);
            ctx.lineTo(x + 3, y + 9);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(x + 8, y - 2.5, 10, 1.5);
            return;
        case 'single': {
            // Monday hair: barely there, never quits. Sways a little.
            const sway = Math.sin(now * 0.006) * 2;
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (underHat) {
                ctx.moveTo(x + BODY_W - 6, y + 2);
                ctx.quadraticCurveTo(x + BODY_W - 2, y + 4, x + BODY_W - 4 + sway * 0.5, y + 8);
            } else {
                ctx.moveTo(x + CX, y);
                ctx.bezierCurveTo(x + CX - 1, y - 6, x + CX + 6 + sway, y - 8, x + CX + 3 + sway, y - 11);
            }
            ctx.stroke();
        }
    }
}

// ─── Hats ───────────────────────────────────────────────────────────────────
// Brims sit around y + 1..3 so they cover the tucked hair's roots. spin is the
// propeller's angle.
function drawHat(ctx, id, x, y, spin) {
    const mx = x + CX;
    switch (id) {
        case 'propeller': {
            // Striped dome cap with a visor at the front
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 3);
            ctx.arc(mx, y + 3, 15, Math.PI, 0);
            ctx.closePath();
            ctx.clip();
            const stripes = ['#ff4d4d', '#ffd23a', '#3fb0ff', '#58d26a'];
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = stripes[i];
                ctx.fillRect(x + 5 + i * 7.5, y - 13, 7.6, 17);
            }
            ctx.restore();
            ctx.fillStyle = '#d63a3a';
            ctx.beginPath();
            ctx.ellipse(mx + 13, y + 3, 9, 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Stem and blades (seen edge-on as they turn)
            ctx.fillStyle = '#666';
            ctx.fillRect(mx - 0.8, y - 17, 1.6, 6);
            const reach = 11 * Math.abs(Math.cos(spin));
            ctx.fillStyle = Math.cos(spin) > 0 ? '#ffd23a' : '#ff9a2a';
            ctx.beginPath();
            ctx.ellipse(mx, y - 17, Math.max(reach, 1.5), 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.arc(mx, y - 17, 1.6, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        case 'backwards':
            ctx.fillStyle = '#e03838';
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 3);
            ctx.arc(mx, y + 3, 16, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
            // Visor out the back, strap hole at the front
            ctx.fillStyle = '#b02020';
            ctx.beginPath();
            ctx.ellipse(x + 1, y + 3, 9, 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(mx, y - 12.5, 1.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x + 26, y - 1, 5, 3);
            return;
        case 'tophat':
            ctx.fillStyle = '#16161c';
            ctx.fillRect(x + 9, y - 17, 22, 19);
            ctx.fillStyle = '#c0283a';
            ctx.fillRect(x + 9, y - 4, 22, 3.5);
            ctx.fillStyle = '#16161c';
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 0.5, 34, 3, 1.5);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.fillRect(x + 11, y - 16, 3, 11);
            return;
        case 'hardhat':
            ctx.fillStyle = '#ffcc1a';
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 2.5);
            ctx.bezierCurveTo(x + 4, y - 14, x + 36, y - 14, x + 36, y + 2.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#e0a800';
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, 38, 3.5, 1.5);
            ctx.fill();
            ctx.fillRect(mx - 2, y - 10, 4, 12);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(x + 10, y - 6, 4, 2);
            return;
        case 'crown':
            ctx.fillStyle = '#ffcf26';
            ctx.strokeStyle = '#b88a00';
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 3);
            ctx.lineTo(x + 7, y - 9);
            ctx.lineTo(x + 13, y - 3);
            ctx.lineTo(mx, y - 12);
            ctx.lineTo(x + 27, y - 3);
            ctx.lineTo(x + 33, y - 9);
            ctx.lineTo(x + 32, y + 3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#e8203a';
            ctx.beginPath();
            ctx.arc(mx, y - 1, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2aa0ff';
            ctx.beginPath();
            ctx.arc(x + 12, y, 1.4, 0, Math.PI * 2);
            ctx.arc(x + 28, y, 1.4, 0, Math.PI * 2);
            ctx.fill();
            return;
        case 'party': {
            // Tilted cone with stripes and a pom-pom
            ctx.save();
            ctx.translate(mx + 3, y + 2);
            ctx.rotate(0.22);
            ctx.beginPath();
            ctx.moveTo(-9, 0);
            ctx.lineTo(0, -19);
            ctx.lineTo(9, 0);
            ctx.closePath();
            ctx.fillStyle = '#7a4dff';
            ctx.fill();
            ctx.save();
            ctx.clip();
            ctx.fillStyle = '#ffd23a';
            for (let i = 0; i < 3; i++) ctx.fillRect(-10, -16 + i * 6, 20, 2.5);
            ctx.restore();
            ctx.fillStyle = '#ff4d8d';
            ctx.beginPath();
            ctx.arc(0, -19, 2.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        case 'beanie':
            ctx.fillStyle = '#2f9e8f';
            ctx.beginPath();
            ctx.moveTo(x + 3, y + 3);
            ctx.bezierCurveTo(x + 3, y - 13, x + 37, y - 13, x + 37, y + 3);
            ctx.closePath();
            ctx.fill();
            // Knit ribs and the fold
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 1; i < 6; i++) {
                ctx.moveTo(x + 3 + i * 5.7, y - 1);
                ctx.lineTo(x + 3 + i * 5.7, y - 7 + Math.abs(i - 3) * 1.5);
            }
            ctx.stroke();
            ctx.fillStyle = '#e8eef0';
            ctx.beginPath();
            ctx.roundRect(x + 2, y - 2, 36, 5.5, 2);
            ctx.fill();
            ctx.fillStyle = '#ff5a5a';
            blob(ctx, [[mx, y - 12, 4]]);
            return;
        case 'umbrellahat': {
            // Headband with a tiny umbrella: finally rated for this altitude
            ctx.fillStyle = '#5a3a1e';
            ctx.fillRect(x + 1, y + 0.5, 38, 3);
            ctx.strokeStyle = '#8b5a2b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mx, y + 1);
            ctx.lineTo(mx, y - 10);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(mx - 13, y - 10);
            ctx.arc(mx, y - 10, 13, Math.PI, 0);
            for (let i = 0; i < 4; i++) ctx.arc(mx + 13 - 3.25 - i * 6.5, y - 10, 3.25, 0, Math.PI, true);
            ctx.closePath();
            ctx.fillStyle = '#cc4488';
            ctx.fill();
            ctx.strokeStyle = '#7a2250';
            ctx.lineWidth = 1;
            ctx.stroke();
            return;
        }
        case 'viking':
            // Horns first, then the helmet over their roots
            ctx.fillStyle = '#f2ead6';
            ctx.strokeStyle = '#b8ab88';
            ctx.lineWidth = 0.8;
            for (const s of [-1, 1]) {
                const bx = mx + s * 13;
                ctx.beginPath();
                ctx.moveTo(bx, y - 2);
                ctx.quadraticCurveTo(bx + s * 9, y - 4, bx + s * 8, y - 15);
                ctx.quadraticCurveTo(bx + s * 4, y - 7, bx - s * 2, y - 6);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#9aa3b2';
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 3);
            ctx.arc(mx, y + 3, 16, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#6c7586';
            ctx.fillRect(x + 4, y, 32, 3.5);
            ctx.fillRect(mx - 1.5, y - 13, 3, 13);
            ctx.fillStyle = '#d8dde6';
            for (const rx of [x + 9, x + 20, x + 31]) {
                ctx.beginPath();
                ctx.arc(rx, y + 1.7, 0.9, 0, Math.PI * 2);
                ctx.fill();
            }
            return;
    }
}

// ─── Emote effects ──────────────────────────────────────────────────────────
// Small and see-through, kept beside and just above the head so they never
// cover what's around the player. Positions come from the emote's seed so each
// effect is drawn without allocating particles.
function seeded(seed, i) {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return v - Math.floor(v);
}

function drawFx(ctx, fx, x, y, emote, k, now) {
    const t = emote.age / emote.dur;
    const seed = emote.seed || 1;
    const top = y - (emote.hatTop || 0); // clear of a hat
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    switch (fx) {
        case 'sparkle': {
            const n = 2 + Math.round(emote.intensity * 3);
            for (let i = 0; i < n; i++) {
                const a = seeded(seed, i) * Math.PI * 2;
                const px = x + CX + Math.cos(a) * (26 + 4 * seeded(seed, i + 9));
                const py = y + 12 + Math.sin(a) * 22;
                const tw = 0.5 + 0.5 * Math.sin(now * 0.02 + i * 2);
                const s = (2 + 2 * emote.intensity) * tw;
                ctx.fillStyle = emote.tint || '#fff6c0';
                ctx.beginPath();
                ctx.moveTo(px, py - s * 1.6);
                ctx.lineTo(px + s * 0.4, py - s * 0.4);
                ctx.lineTo(px + s * 1.6, py);
                ctx.lineTo(px + s * 0.4, py + s * 0.4);
                ctx.lineTo(px, py + s * 1.6);
                ctx.lineTo(px - s * 0.4, py + s * 0.4);
                ctx.lineTo(px - s * 1.6, py);
                ctx.lineTo(px - s * 0.4, py - s * 0.4);
                ctx.closePath();
                ctx.fill();
            }
            break;
        }
        case 'coins':
            for (let i = 0; i < 4; i++) {
                const life = (t * 2.2 + seeded(seed, i)) % 1;
                const px = x + (i % 2 ? BODY_W + 6 : -6) + (seeded(seed, i + 4) - 0.5) * 8;
                const py = y + 12 - life * 26;
                ctx.globalAlpha = 0.85 * k * (1 - life);
                ctx.fillStyle = '#ffd700';
                ctx.strokeStyle = '#b8860b';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.ellipse(px, py, 3 * Math.abs(Math.cos(now * 0.01 + i)), 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            break;
        case 'dizzy':
            for (let i = 0; i < 3; i++) {
                const a = now * 0.006 + (i * Math.PI * 2) / 3;
                miniStar(ctx, x + CX + Math.cos(a) * 18, top - 5 + Math.sin(a) * 4, 3, '#ffe14a');
            }
            break;
        case 'zzz':
            ctx.fillStyle = '#e8ecff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let i = 0; i < 3; i++) {
                const life = (t * 1.8 + i / 3) % 1;
                ctx.globalAlpha = 0.85 * k * Math.sin(life * Math.PI);
                ctx.font = `bold ${6 + life * 5}px sans-serif`;
                ctx.fillText('z', x + BODY_W + 3 + life * 10, y + 4 - life * 18);
            }
            break;
        case 'sweat': {
            // Drops flicking off the side of the head
            const n = emote.id === 'panic' ? 2 : 1;
            for (let i = 0; i < n; i++) {
                const life = (t * (emote.id === 'panic' ? 3 : 1.2) + i * 0.5) % 1;
                const s = i % 2 ? -1 : 1;
                const px = (s > 0 ? x + BODY_W + 2 : x - 2) + s * life * 6;
                const py = y + 6 + life * 6;
                ctx.globalAlpha = 0.85 * k * (1 - life * 0.6);
                ctx.fillStyle = '#9fd8ff';
                ctx.beginPath();
                ctx.moveTo(px, py - 4);
                ctx.quadraticCurveTo(px + 3, py + 0.5, px, py + 2.5);
                ctx.quadraticCurveTo(px - 3, py + 0.5, px, py - 4);
                ctx.fill();
            }
            break;
        }
        case 'exclaim': {
            const bob = Math.sin(Math.min(t * 6, 1) * Math.PI * 0.5);
            ctx.fillStyle = '#ffe14a';
            ctx.strokeStyle = '#0d1640';
            ctx.lineWidth = 1;
            const px = x + BODY_W + 5;
            const py = y - 4 - bob * 4;
            ctx.beginPath();
            ctx.roundRect(px - 1.5, py - 8, 3, 7, 1.5);
            ctx.arc(px, py + 2, 1.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            break;
        }
        case 'vein': {
            // Little anger mark on the top corner
            const pulse = 1 + 0.15 * Math.sin(now * 0.03);
            ctx.strokeStyle = '#ff3b3b';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            const px = x + BODY_W - 4;
            const py = y + 3;
            ctx.beginPath();
            for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                ctx.moveTo(px + dx * 1.2 * pulse, py + dy * 3.5 * pulse);
                ctx.quadraticCurveTo(px + dx * 1.2 * pulse, py + dy * 1.2 * pulse, px + dx * 3.5 * pulse, py + dy * 1.2 * pulse);
            }
            ctx.stroke();
            break;
        }
        case 'note': {
            const life = (t * 1.5) % 1;
            const px = x - 6 - Math.sin(life * Math.PI * 2) * 3;
            const py = y + 6 - life * 16;
            ctx.globalAlpha = 0.85 * k * Math.sin(life * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.ellipse(px, py, 2.2, 1.6, -0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(px + 2, py);
            ctx.lineTo(px + 2, py - 7);
            ctx.lineTo(px + 5, py - 5.5);
            ctx.stroke();
            break;
        }
        case 'boing':
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                const bx = s < 0 ? x - 4 : x + BODY_W + 4;
                for (let i = 0; i < 2; i++) {
                    ctx.moveTo(bx, y + 10 + i * 8);
                    ctx.lineTo(bx + s * (3 + 3 * Math.sin(t * Math.PI)), y + 8 + i * 8);
                }
            }
            ctx.stroke();
            break;
        case 'confetti': {
            const colors = ['#ff4d6d', '#ffd23a', '#4dd2ff', '#7cff6b', '#c77dff'];
            for (let i = 0; i < 8; i++) {
                const fall = (t * 1.4 + seeded(seed, i) * 0.5) % 1;
                const px = x + CX + (seeded(seed, i + 20) - 0.5) * 70;
                const py = top - 14 + fall * 34;
                ctx.globalAlpha = 0.85 * k * (1 - fall * 0.7);
                ctx.fillStyle = colors[i % colors.length];
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(now * 0.01 + i);
                ctx.fillRect(-1.5, -0.8, 3, 1.6);
                ctx.restore();
            }
            break;
        }
        case 'hearts':
            for (let i = 0; i < 3; i++) {
                const life = (t * 1.6 + i / 3) % 1;
                ctx.globalAlpha = 0.85 * k * (1 - life);
                miniHeart(ctx, x + CX + (i - 1) * 18 + Math.sin(life * 6 + i) * 2, top - 2 - life * 16, 2.6, '#ff4d7d');
            }
            break;
    }
    ctx.restore();
}

// How far a hat reaches above the head, so effects can float clear of it
const HAT_TOP = { propeller: 20, backwards: 13, tophat: 17, hardhat: 11, crown: 12, party: 22, beanie: 16, umbrellahat: 23, viking: 15 };

export function hatHeight(look) {
    return look.hat ? HAT_TOP[look.hat] || 0 : 0;
}

// ─── Public ─────────────────────────────────────────────────────────────────
// o: { look, gaze, emote, blink, now, spin, gum, outline }
//   look  resolved ids per slot (see wardrobe.resolveLook)
//   gaze  pupil direction, each axis -1..1
//   emote { id, age, dur, variant, intensity, seed } or null
//   blink true to close the eyes for a moment (only while not emoting)
//   spin  propeller angle; gum 0..1 bubble size; outline a body stroke color (star power)
export function drawBlunday(ctx, x, y, h, o) {
    const { look, now = 0 } = o;
    const gaze = o.gaze || { x: 0, y: 0 };
    const color = getColor(look.color);
    const emote = o.emote;
    const t = emote ? Math.min(emote.age / emote.dur, 1) : 0;
    const k = emote ? envelope(t) : 0;
    let face = faceFor(emote);
    // Faces switch over in the fade-out, so the expression doesn't flicker
    if (emote && k < 0.35 && t > 0.5) face = NEUTRAL;
    if (!emote && o.blink) face = FACES.blink[0];

    drawBody(ctx, x, y, h, color, now, o.outline);

    // Face
    drawEye(ctx, face.eyes, x + EYE_L, y + EYE_Y, -1, color, gaze, now);
    drawEye(ctx, face.eyes, x + EYE_R, y + EYE_Y, 1, color, gaze, now);
    drawMouth(ctx, face.mouth, x, y, color, now, t, emote ? emote.intensity ?? 0.5 : 0.5);
    drawFeet(ctx, x, y, h, color);

    if (look.face) drawFaceItem(ctx, look.face, x, y, OPEN_MOUTHS.has(face.mouth), o.gum ?? 0);

    if (look.glasses) {
        const slip = glassesSlip(look, face, k);
        drawGlasses(ctx, look.glasses, x, y + slip);
    }
    if (look.hair) drawHair(ctx, look.hair, x, y, !!look.hat, now);
    if (look.hat) drawHat(ctx, look.hat, x, y, o.spin ?? 0);

    if (emote && face.fx && k > 0) {
        emote.hatTop = hatHeight(look);
        drawFx(ctx, face.fx, x, y, emote, k, now);
    }
}
