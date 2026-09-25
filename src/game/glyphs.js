// Glyph drawing functions — all take (ctx, cx, cy) where cx/cy is the center.
// Self-contained: no engine.js closure dependencies.

function _drawStarShape(ctx, cx, cy, outerR, innerR, points, color) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const angle  = (i * Math.PI) / points - Math.PI / 2;
        const radius = i % 2 === 0 ? outerR : innerR;
        const px     = cx + Math.cos(angle) * radius;
        const py     = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

export function drawJetpackGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Body
    ctx.fillStyle = '#cc4444';
    ctx.beginPath();
    ctx.roundRect(-5, -10, 10, 18, 3);
    ctx.fill();
    // Flame
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(-4, 8);
    ctx.lineTo(4, 8);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
    // Window
    ctx.fillStyle = '#aaddff';
    ctx.beginPath();
    ctx.arc(0, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Twin boosters: two chunky jetpacks with blue-hot cores in their flames.
export function drawBoosterGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    for (const x of [-7, 7]) {
        // Outer flame
        ctx.fillStyle = '#ff7a1a';
        ctx.beginPath();
        ctx.moveTo(x - 4, 6);
        ctx.lineTo(x + 4, 6);
        ctx.lineTo(x, 15);
        ctx.closePath();
        ctx.fill();
        // Inner core
        ctx.fillStyle = '#bfe8ff';
        ctx.beginPath();
        ctx.moveTo(x - 2, 6);
        ctx.lineTo(x + 2, 6);
        ctx.lineTo(x, 11);
        ctx.closePath();
        ctx.fill();
        // Body with nose cone
        ctx.fillStyle = '#d23a3a';
        ctx.beginPath();
        ctx.moveTo(x - 5, 6);
        ctx.lineTo(x - 5, -8);
        ctx.quadraticCurveTo(x, -16, x + 5, -8);
        ctx.lineTo(x + 5, 6);
        ctx.closePath();
        ctx.fill();
        // Stripe
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(x - 5, 0, 10, 2);
        // Window
        ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.arc(x, -5, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// One spring boot: shaft + toe pointing right, with a zigzag spring under the sole.
// x0 is the heel's left edge; the boot spans x0..x0+8.
function _drawSpringBoot(ctx, x0) {
    // Spring
    ctx.strokeStyle = '#ccaaff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 + 4, 2);
    for (let i = 0; i < 4; i++) ctx.lineTo(i % 2 === 0 ? x0 + 1.5 : x0 + 6.5, 3.5 + i * 1.6);
    ctx.lineTo(x0 + 4, 9.5);
    ctx.stroke();
    // Shaft and foot
    ctx.fillStyle = '#8844cc';
    ctx.beginPath();
    ctx.roundRect(x0, -9, 5, 10, 1.5);
    ctx.roundRect(x0, -3, 8, 4, 2);
    ctx.fill();
    // Cuff
    ctx.fillStyle = '#aa77ee';
    ctx.fillRect(x0, -9, 5, 2);
    // Sole
    ctx.fillStyle = '#55288a';
    ctx.fillRect(x0, 0.5, 8, 1.5);
}

export function drawBootsGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    _drawSpringBoot(ctx, -10);
    _drawSpringBoot(ctx, 2); // 4px gap keeps the pair distinct at small sizes
    ctx.restore();
}

export function drawStarGlyph(ctx, cx, cy) {
    // Glow
    const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14);
    grd.addColorStop(0, 'rgba(255,220,0,0.5)');
    grd.addColorStop(1, 'rgba(255,220,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    // Star shape
    _drawStarShape(ctx, cx, cy, 9, 4, 5, '#ffdd00');
}

export function drawCoinGlyph(ctx, cx, cy) {
    // Gold circle
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    // Rim
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    // Highlight
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    // Dollar symbol
    ctx.fillStyle = '#8b6914';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx + 1, cy + 1);
}

export function drawCoinBagGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Bag body — rounded pouch
    ctx.fillStyle = '#b8860b';
    ctx.beginPath();
    ctx.roundRect(-7, -3, 14, 13, 5);
    ctx.fill();
    // Bag highlight
    ctx.fillStyle = 'rgba(255,220,80,0.3)';
    ctx.beginPath();
    ctx.roundRect(-5, -1, 6, 5, 3);
    ctx.fill();
    // Neck
    ctx.fillStyle = '#8b6914';
    ctx.beginPath();
    ctx.roundRect(-4, -9, 8, 7, 2);
    ctx.fill();
    // Drawstring knot
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, -9, 3, 0, Math.PI * 2);
    ctx.fill();
    // Dollar symbol on bag
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 4);
    ctx.restore();
}

export function drawScoreGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Trophy cup body
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.roundRect(-7, -10, 14, 12, 3);
    ctx.fill();
    // Cup highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(-5, -8, 5, 5, 2);
    ctx.fill();
    // Handles
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-7, -5, 4, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -5, 4, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    // Stem
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-2, 2, 4, 5);
    // Base
    ctx.beginPath();
    ctx.roundRect(-6, 7, 12, 4, 2);
    ctx.fill();
    ctx.restore();
}

export function drawGoldBarGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Main trapezoid face
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(6, -5);
    ctx.lineTo(9, 6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();
    // Lighter top face
    ctx.fillStyle = '#ffe680';
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(6, -5);
    ctx.lineTo(4, -2);
    ctx.lineTo(-4, -2);
    ctx.closePath();
    ctx.fill();
    // Outline
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(6, -5);
    ctx.lineTo(9, 6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

export function drawRedGemGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Main diamond body
    ctx.fillStyle = '#dd2244';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(8, -2);
    ctx.lineTo(0, 9);
    ctx.lineTo(-8, -2);
    ctx.closePath();
    ctx.fill();
    // Top facet
    ctx.fillStyle = '#ff6688';
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(4, -3);
    ctx.lineTo(0, -8);
    ctx.closePath();
    ctx.fill();
    // Left facet
    ctx.fillStyle = '#ff88aa';
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-4, -3);
    ctx.lineTo(0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function drawUmbrellaGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Canopy
    ctx.fillStyle = '#cc4488';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.arc(0, 0, 10, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    // Ribs
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 0);
    ctx.moveTo(-5, -8.6);
    ctx.lineTo(-5, 0);
    ctx.moveTo(5, -8.6);
    ctx.lineTo(5, 0);
    ctx.stroke();
    // Pole
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 9);
    ctx.stroke();
    // Hook
    ctx.beginPath();
    ctx.arc(-2, 9, 2, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();
}

export function drawCrownGlyph(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // Crown body
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(-9, 6);
    ctx.lineTo(-9, -4);
    ctx.lineTo(-4, 1);
    ctx.lineTo(0, -7);
    ctx.lineTo(4, 1);
    ctx.lineTo(9, -4);
    ctx.lineTo(9, 6);
    ctx.closePath();
    ctx.fill();
    // Band
    ctx.fillStyle = '#e6b800';
    ctx.fillRect(-9, 4, 18, 3);
    // Center jewel
    ctx.fillStyle = '#ff4466';
    ctx.beginPath();
    ctx.arc(0, 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Side jewels
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(-5, 3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, 3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
