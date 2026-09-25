import { forwardRef } from 'react';
import { RENDER_WIDTH, RENDER_HEIGHT } from '../game/engine.js';

const GameCanvas = forwardRef(function GameCanvas(_props, ref) {
    return (
        <canvas
            ref={ref}
            id="game"
            width={RENDER_WIDTH}
            height={RENDER_HEIGHT}
        />
    );
});

export default GameCanvas;
