// Space background. As the player climbs, the sky shifts through
// the colors of the solar system, a planet drifts past at each milestone (in
// real order outward from Earth), twinkling stars come out from 70k on, and
// past Pluto waits a black hole.
// Everything is keyed to height climbed so it moves smoothly, without the jumps
// that pickup score bonuses would cause.

// Sky gradient (top, bottom) per stage. Each stage's colors hold until
// SKY_FADE before the next milestone, then blend into the next stage's.
const EARTH_SKY = ['#1a0a3c', '#2a4a7a'];
const SKY_FADE  = 10000;

const PLANET_PASS = 11000; // height climbed while a planet drifts across the screen
const PLANET_LEAD = 1000;  // it starts drifting in this much before its milestone

const STAR_START = 70000;
const STAR_FULL  = 80000;
const STAR_COUNT = 70;

const STAGES = [
    { at: 30000,  sky: ['#22222e', '#5a5e6e'], planet: 'moon',      radius: 70,  x: 0.72 },
    { at: 100000, sky: ['#2e0f0c', '#8a3a24'], planet: 'mars',      radius: 55,  x: 0.28 },
    { at: 150000, sky: ['#2a1a0e', '#9a6a3a'], planet: 'jupiter',   radius: 120, x: 0.80 },
    { at: 200000, sky: ['#2a2412', '#a8925a'], planet: 'saturn',    radius: 80,  x: 0.30 },
    { at: 250000, sky: ['#0c2e34', '#3e9aa2'], planet: 'uranus',    radius: 70,  x: 0.70 },
    { at: 300000, sky: ['#0a1240', '#2848a8'], planet: 'neptune',   radius: 70,  x: 0.30 },
    { at: 350000, sky: ['#1e1820', '#8a7468'], planet: 'pluto',     radius: 38,  x: 0.65 },
    { at: 500000, sky: ['#07040c', '#2a1430'], planet: 'blackHole', radius: 55,  x: 0.50 },
];

function clamp01(t) {
    return Math.min(Math.max(t, 0), 1);
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Sky colors at a height: the latest stage reached, blending into the next
function skyAt(h) {
    let prev = EARTH_SKY;
    for (const stage of STAGES) {
        const fadeStart = stage.at - SKY_FADE;
        if (h < fadeStart) break;
        if (h < stage.at) {
            // Quantised so the gradient cache only sees a few dozen variants per fade
            const t = Math.round(((h - fadeStart) / SKY_FADE) * 48) / 48;
            return [mixColor(prev[0], stage.sky[0], t), mixColor(prev[1], stage.sky[1], t)];
        }
        prev = stage.sky;
    }
    return prev;
}

// ─── Planet painters ─────────────────────────────────────────────────────────
// Each paints a planet of radius R centered at (0, 0), already clipped to its disc.

function blotches(ctx, R, color, list) {
    ctx.fillStyle = color;
    for (const [x, y, r] of list) {
        ctx.beginPath();
        ctx.arc(x * R, y * R, r * R, 0, Math.PI * 2);
        ctx.fill();
    }
}

function bands(ctx, R, colors) {
    const h = (2 * R) / colors.length;
    colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(-R, -R + i * h, 2 * R, h + 0.5);
    });
}

const PAINTERS = {
    moon(ctx, R) {
        ctx.fillStyle = '#c9c9cf';
        ctx.fillRect(-R, -R, 2 * R, 2 * R);
        // Maria (the dark "seas")
        blotches(ctx, R, '#a2a2ab', [[-0.3, -0.25, 0.35], [0.15, -0.1, 0.25], [0.25, 0.35, 0.22], [-0.1, 0.2, 0.18]]);
        // Craters: dark bowl with a lit rim
        for (const [x, y, r] of [[0.5, -0.45, 0.12], [-0.55, 0.45, 0.1], [0.05, 0.62, 0.08], [0.6, 0.25, 0.07], [-0.2, -0.65, 0.07], [-0.65, -0.05, 0.06]]) {
            ctx.fillStyle = '#8d8d96';
            ctx.beginPath();
            ctx.arc(x * R, y * R, r * R, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = r * R * 0.25;
            ctx.beginPath();
            ctx.arc(x * R, y * R, r * R, Math.PI * 0.6, Math.PI * 1.6);
            ctx.stroke();
        }
    },
    mars(ctx, R) {
        ctx.fillStyle = '#c1502a';
        ctx.fillRect(-R, -R, 2 * R, 2 * R);
        blotches(ctx, R, '#8e3418', [[-0.35, 0.05, 0.3], [0.3, 0.3, 0.22], [0.1, -0.3, 0.18], [-0.1, 0.55, 0.15]]);
        blotches(ctx, R, '#d9774a', [[0.45, -0.1, 0.2], [-0.5, -0.45, 0.16]]);
        // Polar cap
        ctx.fillStyle = '#f4ece6';
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.95, R * 0.45, R * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
    },
    jupiter(ctx, R) {
        bands(ctx, R, ['#c9a77e', '#e6d3b4', '#a86e45', '#e9d8bb', '#c08a5c', '#f0e2c8', '#a2653e', '#e2cba6', '#b98458', '#d8bf98']);
        // Great Red Spot
        ctx.fillStyle = '#c0573c';
        ctx.beginPath();
        ctx.ellipse(R * 0.3, R * 0.32, R * 0.22, R * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8b49a';
        ctx.lineWidth = R * 0.03;
        ctx.stroke();
    },
    saturn(ctx, R) {
        bands(ctx, R, ['#d9c08a', '#ecdcb0', '#c7a96c', '#efe2bd', '#d2b67e', '#e6d3a4', '#bfa064']);
    },
    uranus(ctx, R) {
        bands(ctx, R, ['#9fdde3', '#aee6eb', '#a6e1e7', '#b6eaee', '#9ad8df']);
    },
    neptune(ctx, R) {
        bands(ctx, R, ['#3557c9', '#4268d6', '#3a5ccc', '#4a72de', '#3150bf', '#3d61d0']);
        // Great Dark Spot with its white companion cloud
        ctx.fillStyle = '#1f3591';
        ctx.beginPath();
        ctx.ellipse(-R * 0.25, R * 0.15, R * 0.2, R * 0.11, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(-R * 0.1, R * 0.33, R * 0.14, R * 0.035, -0.2, 0, Math.PI * 2);
        ctx.fill();
    },
    pluto(ctx, R) {
        ctx.fillStyle = '#b38d6e';
        ctx.fillRect(-R, -R, 2 * R, 2 * R);
        blotches(ctx, R, '#7e5a42', [[-0.55, 0.2, 0.35], [0.5, -0.5, 0.2]]);
        // Tombaugh Regio, the "heart"
        ctx.fillStyle = '#efe1cf';
        ctx.beginPath();
        ctx.moveTo(R * 0.2, R * 0.55);
        ctx.bezierCurveTo(R * -0.35, R * 0.15, R * -0.1, R * -0.35, R * 0.18, R * -0.08);
        ctx.bezierCurveTo(R * 0.45, R * -0.4, R * 0.75, R * 0.1, R * 0.2, R * 0.55);
        ctx.fill();
    },
};

// Ringed planets: [outer ring radius (× R), flattening, tilt, color]
const RINGS = {
    saturn: [2.1, 0.28, -0.32, 'rgba(225,205,160,0.85)'],
    uranus: [1.7, 0.95, 1.35,  'rgba(210,240,245,0.35)'],
};

function drawRing(ctx, R, ring, front) {
    const [outer, flat, tilt, color] = ring;
    ctx.strokeStyle = color;
    // Concentric bands with a gap, like Saturn's Cassini division
    for (const [k, w] of [[outer, 0.18], [outer - 0.3, 0.12]]) {
        ctx.lineWidth = R * w;
        ctx.beginPath();
        // The ring's near half (in front of the planet) is the lower one
        ctx.ellipse(0, 0, R * k, R * k * flat, tilt, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        ctx.stroke();
    }
}

function makePlanetSprite(name, R, renderScale) {
    const ring = RINGS[name];
    const half = ring ? R * ring[0] + R * 0.2 : R + 2; // reach in logical units
    const canvas = document.createElement('canvas');
    canvas.width  = Math.ceil(half * 2 * renderScale);
    canvas.height = canvas.width;
    const ctx = canvas.getContext('2d');
    ctx.scale(renderScale, renderScale);
    ctx.translate(half, half);

    if (ring) drawRing(ctx, R, ring, false);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    PAINTERS[name](ctx, R);
    // Sunlight from the upper left, night side falling off to the lower right
    const shade = ctx.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.1, -R * 0.2, -R * 0.2, R * 1.35);
    shade.addColorStop(0,   'rgba(255,255,255,0.18)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1,   'rgba(0,0,10,0.6)');
    ctx.fillStyle = shade;
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
    ctx.restore();

    if (ring) drawRing(ctx, R, ring, true);
    return { canvas, half };
}

// ─── Black hole ──────────────────────────────────────────────────────────────
// Interstellar-style: a black shadow ringed by the lensed image of its
// accretion disk (arching over and under it), with the flat disk itself
// cutting across the front. The disk spins, and its left side, rushing toward
// us, is Doppler-brightened.

const BH_DISK_RX     = 3.2;   // disk reach, x shadow radius
const BH_DISK_FLAT   = 0.16;  // disk height / width
const BH_HALO        = 1.3;   // lensed ring radius, x shadow radius
const BH_REACH       = 3.6;   // how far the whole thing extends, x shadow radius
const BH_SPARK_COUNT = 60;

function createBlackHole(ctx, R, renderScale) {
    // Warm glow behind everything, pre-rendered once
    const glowSize = R * BH_REACH * 2;
    const glow = document.createElement('canvas');
    glow.width = glow.height = Math.ceil(glowSize * renderScale);
    const gctx = glow.getContext('2d');
    const gr = glow.width / 2;
    const grad = gctx.createRadialGradient(gr, gr, 0, gr, gr, gr);
    grad.addColorStop(0,    'rgba(255,170,80,0.55)');
    grad.addColorStop(0.35, 'rgba(255,120,40,0.22)');
    grad.addColorStop(1,    'rgba(255,90,20,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, glow.width, glow.height);

    // Disk gradients, in the black hole's own coordinates (it's drawn translated)
    const rx = R * BH_DISK_RX;
    function beamed(bright, dim) {
        const g = ctx.createLinearGradient(-rx, 0, rx, 0);
        g.addColorStop(0,   dim);
        g.addColorStop(0.3, bright);
        g.addColorStop(0.7, dim);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        return g;
    }
    const DISK_LAYERS = [
        [0.55, beamed('rgba(255,140,50,0.55)',  'rgba(200,80,20,0.25)')],
        [0.26, beamed('rgba(255,205,130,0.85)', 'rgba(255,140,60,0.45)')],
        [0.08, beamed('rgba(255,250,235,1)',    'rgba(255,210,160,0.7)')],
    ];
    const haloGrad = ctx.createLinearGradient(0, -R * BH_HALO, 0, R * BH_HALO);
    haloGrad.addColorStop(0,   'rgba(255,235,200,0.95)');
    haloGrad.addColorStop(0.5, 'rgba(255,170,90,0.5)');
    haloGrad.addColorStop(1,   'rgba(255,215,160,0.85)');

    const sparks = Array.from({ length: BH_SPARK_COUNT }, () => ({
        angle:  Math.random() * Math.PI * 2,
        radius: 1.15 + Math.random() * (BH_DISK_RX - 1.3), // x R, outside the shadow
        size:   0.6 + Math.random() * 1.4,
    }));

    // One half of the flat disk: the far (upper) half sits behind the shadow,
    // the near (lower) half in front of it
    function drawDisk(front) {
        const start = front ? 0 : Math.PI;
        for (const [w, style] of DISK_LAYERS) {
            ctx.strokeStyle = style;
            ctx.lineWidth = R * w;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * 0.82, rx * 0.82 * BH_DISK_FLAT, 0, start, start + Math.PI);
            ctx.stroke();
        }
    }

    function drawSparks(front, now) {
        for (const sp of sparks) {
            // Inner sparks orbit faster, like real orbits
            const a = sp.angle + now * 0.0016 / Math.pow(sp.radius, 1.5);
            const sin = Math.sin(a);
            if ((sin >= 0) !== front) continue;
            const cos = Math.cos(a);
            const x = cos * sp.radius * R;
            const y = sin * sp.radius * R * BH_DISK_FLAT;
            // Doppler: brighter where the disk swings toward us (the left side)
            ctx.globalAlpha = 0.35 + 0.65 * (0.5 - cos * 0.5);
            ctx.fillRect(x - sp.size, y - sp.size * 0.3, sp.size * 2, sp.size * 0.6);
        }
        ctx.globalAlpha = 1;
    }

    function draw(cx, cy, now) {
        const pulse = 0.85 + 0.15 * Math.sin(now * 0.0025);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pulse;
        ctx.drawImage(glow, -glowSize / 2, -glowSize / 2, glowSize, glowSize);
        ctx.globalAlpha = 1;

        drawDisk(false);
        ctx.fillStyle = '#ffe2b0';
        drawSparks(false, now);

        // Lensed disk: a bright ring bent up over and down under the shadow,
        // shimmering slightly as it turns
        ctx.strokeStyle = haloGrad;
        ctx.lineWidth = R * (0.32 + 0.04 * Math.sin(now * 0.004));
        ctx.beginPath();
        ctx.ellipse(0, 0, R * BH_HALO * 1.04, R * BH_HALO, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        // Event horizon shadow, edged by the razor-thin photon ring
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,240,215,${0.75 * pulse})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.04, 0, Math.PI * 2);
        ctx.stroke();

        drawDisk(true);
        ctx.fillStyle = '#fff4dc';
        drawSparks(true, now);
        ctx.restore();
    }

    return { half: R * BH_REACH, draw };
}

export function createSpaceBackground(ctx, width, height, renderScale) {
    const gradients = new Map(); // "top|bottom" -> CanvasGradient
    const sprites   = {};        // planet name -> { canvas, half } (or { half, draw } if animated), made on first sight

    const stars = Array.from({ length: STAR_COUNT }, () => ({
        x:       Math.random() * width,
        yOffset: Math.random() * height,
        size:    0.6 + Math.random() * 1.1,
        speed:   0.01 + Math.random() * 0.03,
        phase:   Math.random() * Math.PI * 2,
        rate:    0.002 + Math.random() * 0.004,
    }));

    function skyGradient(top, bottom) {
        const key = `${top}|${bottom}`;
        let grad = gradients.get(key);
        if (!grad) {
            if (gradients.size > 64) gradients.clear();
            grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, top);
            grad.addColorStop(1, bottom);
            gradients.set(key, grad);
        }
        return grad;
    }

    function drawSky(h) {
        const [top, bottom] = skyAt(h);
        ctx.fillStyle = skyGradient(top, bottom);
        ctx.fillRect(0, 0, width, height);
    }

    // Stars and the passing planet. camY is the (negative) camera position.
    function drawScenery(h, camY, now) {
        const starAlpha = clamp01((h - STAR_START) / (STAR_FULL - STAR_START));
        if (starAlpha > 0) {
            ctx.fillStyle = '#fff';
            for (const s of stars) {
                const y = (((s.yOffset + camY * s.speed) % height) + height) % height;
                ctx.globalAlpha = starAlpha * (0.45 + 0.55 * Math.abs(Math.sin(now * s.rate + s.phase)));
                ctx.fillRect(s.x - s.size / 2, y - s.size / 2, s.size, s.size);
            }
            ctx.globalAlpha = 1;
        }

        for (const stage of STAGES) {
            const t = (h - (stage.at - PLANET_LEAD)) / PLANET_PASS;
            if (t < 0 || t > 1) continue;
            const sprite = sprites[stage.planet] ||= stage.planet === 'blackHole'
                ? createBlackHole(ctx, stage.radius, renderScale)
                : makePlanetSprite(stage.planet, stage.radius, renderScale);
            const cx = stage.x * width;
            const cy = -sprite.half + t * (height + sprite.half * 2);
            if (sprite.draw) sprite.draw(cx, cy, now); // animated, drawn live every frame
            else ctx.drawImage(sprite.canvas, cx - sprite.half, cy - sprite.half, sprite.half * 2, sprite.half * 2);
        }

        // The old background's bubbles thin out as space takes over
        return 1 - starAlpha * 0.8;
    }

    return { drawSky, drawScenery };
}
