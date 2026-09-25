import { useEffect, useRef } from 'react';
import { drawJetpackGlyph, drawBootsGlyph, drawStarGlyph, drawScoreGlyph, drawCoinBagGlyph, drawGoldBarGlyph, drawRedGemGlyph, drawCrownGlyph } from '../game/glyphs.js';

export default function AchievementIcon({ icon }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, 18, 18);
        ctx.save();
        ctx.scale(0.5625, 0.5625);
        const cx = 16;
        const cy = 16;
        if (icon === 'jetpack')      drawJetpackGlyph(ctx, cx, cy);
        else if (icon === 'boots')   drawBootsGlyph(ctx, cx, cy);
        else if (icon === 'star')    drawStarGlyph(ctx, cx, cy);
        else if (icon === 'score')   drawScoreGlyph(ctx, cx, cy);
        else if (icon === 'bag')     drawCoinBagGlyph(ctx, cx, cy);
        else if (icon === 'bar')     drawGoldBarGlyph(ctx, cx, cy);
        else if (icon === 'gem')     drawRedGemGlyph(ctx, cx, cy);
        else if (icon === 'crown')   drawCrownGlyph(ctx, cx, cy);
        ctx.restore();
    }, [icon]);

    return <canvas ref={canvasRef} width="18" height="18" />;
}
