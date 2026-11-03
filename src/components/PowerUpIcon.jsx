import { useEffect, useRef } from 'react';
import { drawJetpackGlyph, drawBoosterGlyph, drawBootsGlyph, drawStarGlyph, drawUmbrellaGlyph, drawMagnetGlyph } from '../game/glyphs.js';

// The power-up glyph for an effect bar entry (EffectBar). Glyphs are drawn for
// a 32x32 box centered at (16, 16); scaled to the requested size.
const GLYPHS = {
    jetpack:  drawJetpackGlyph,
    booster:  drawBoosterGlyph,
    boots:    drawBootsGlyph,
    star:     drawStarGlyph,
    umbrella: drawUmbrellaGlyph,
    magnet:   drawMagnetGlyph,
};

export default function PowerUpIcon({ icon, size = 18 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.scale(size / 32, size / 32);
        GLYPHS[icon]?.(ctx, 16, 16);
        ctx.restore();
    }, [icon, size]);

    return <canvas ref={canvasRef} width={size} height={size} />;
}
