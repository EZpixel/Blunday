import { forwardRef } from 'react';

const GameCanvas = forwardRef(function GameCanvas(_props, ref) {
    return (
        <canvas
            ref={ref}
            id="game"
            width={400}
            height={600}
        />
    );
});

export default GameCanvas;
