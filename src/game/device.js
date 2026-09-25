// Mobile OS detection (Android, iOS, iPadOS), used to pick touch vs keyboard hints.
// iPadOS Safari reports itself as a Mac, so a "Mac" with a touchscreen is an iPad.
function detectMobile() {
    if (typeof navigator === 'undefined') return false;
    if (navigator.userAgentData?.mobile) return true;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
    return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

export const isMobile = detectMobile();
