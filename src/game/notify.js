// Plain text notifications from anywhere in the UI (e.g. "Couldn't connect"),
// shown by App in the same queue as achievement toasts, one after another.
const subscribers = new Set();

export function subscribeNotifications(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

export function notify(text) {
    for (const fn of subscribers) fn(text);
}
