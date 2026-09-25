import { useEffect, useRef } from 'react';
import { drawJetpackGlyph, drawBootsGlyph, drawStarGlyph, drawUmbrellaGlyph, drawScoreGlyph, drawCoinBagGlyph, drawGoldBarGlyph, drawRedGemGlyph, drawCrownGlyph } from '../game/glyphs.js';

// Glyphs are drawn for a 32x32 box centered at (16, 16); scale to the requested size.
export default function AchievementIcon({ icon, size = 18 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.scale(size / 32, size / 32);
        const cx = 16;
        const cy = 16;
        if (icon === 'jetpack')       drawJetpackGlyph(ctx, cx, cy);
        else if (icon === 'boots')    drawBootsGlyph(ctx, cx, cy);
        else if (icon === 'star')     drawStarGlyph(ctx, cx, cy);
        else if (icon === 'umbrella') drawUmbrellaGlyph(ctx, cx, cy);
        else if (icon === 'score')    drawScoreGlyph(ctx, cx, cy);
        else if (icon === 'bag')      drawCoinBagGlyph(ctx, cx, cy);
        else if (icon === 'bar')      drawGoldBarGlyph(ctx, cx, cy);
        else if (icon === 'gem')      drawRedGemGlyph(ctx, cx, cy);
        else if (icon === 'crown')    drawCrownGlyph(ctx, cx, cy);
        ctx.restore();
    }, [icon, size]);

    return <canvas ref={canvasRef} width={size} height={size} />;
}
