import { useEffect, useState } from 'react';
import { resolveLook, subscribeWardrobe } from '../game/wardrobe.js';

// Blunday's equipped look, kept up to date with the Character screen
export default function useLook() {
    const [look, setLook] = useState(resolveLook);
    useEffect(() => subscribeWardrobe(() => setLook(resolveLook())), []);
    return look;
}
