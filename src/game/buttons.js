// Button presses that survive a long hold. Mobile browsers turn a held touch
// into a long press and then drop the click, so a button held for a moment
// did nothing on release. Pointer clicks on buttons are handled here instead:
// a press fires when it is released over the button it started on, however
// long it was held, and is canceled by sliding off the button first.
// Keyboard activation (Enter/Space) still uses the native click.
export function installReliableClicks(root) {
    let pressed = null; // { button, pointerId }

    function onPointerDown(e) {
        if (e.button !== 0) return;
        const button = e.target.closest?.('button');
        pressed = button && !button.disabled ? { button, pointerId: e.pointerId } : null;
    }

    function onPointerUp(e) {
        if (!pressed || e.pointerId !== pressed.pointerId) return;
        const { button } = pressed;
        pressed = null;
        // Touch pointers stay targeted at where they started, so hit-test the
        // release point to see whether the finger is still on the button
        const under = document.elementFromPoint(e.clientX, e.clientY);
        if (under && button.contains(under) && !button.disabled) button.click();
    }

    function onPointerCancel(e) {
        if (pressed && e.pointerId === pressed.pointerId) pressed = null;
    }

    // Native clicks from a pointer (detail > 0) are replaced by the ones above;
    // our own button.click() and keyboard clicks have detail 0 and pass through
    function onClick(e) {
        if (e.detail > 0 && e.target.closest?.('button')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // No long-press menu over the game
    function onContextMenu(e) {
        e.preventDefault();
    }

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    root.addEventListener('click', onClick, { capture: true });
    root.addEventListener('contextmenu', onContextMenu);
    return () => {
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('pointerup', onPointerUp);
        root.removeEventListener('pointercancel', onPointerCancel);
        root.removeEventListener('click', onClick, { capture: true });
        root.removeEventListener('contextmenu', onContextMenu);
    };
}
