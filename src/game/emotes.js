// Blunday's moods. The engine reports what happens (a gem, a close call, a
// jetpack kicking in) and this decides whether Blunday reacts. Reactions are
// deliberately occasional: each event only has a chance to trigger one, the
// same emote doesn't repeat for a while, and after any emote there's a random
// quiet spell. Bigger moments (a purple gem, being saved from doom) have a
// higher priority and can cut in.
// Everything counts in physics steps (60 per second).

const QUIET_AFTER  = [150, 360];  // random pause after an emote ends
const SAME_EMOTE_GAP = 600;       // the same emote waits at least this long to come back
const BLINK_EVERY  = [120, 360];
const BLINK_FRAMES = 7;

// Defaults per emote: how long it lasts and how important it is
const DEFAULTS = {
    smile:      { dur: 100, priority: 1 },
    tongue:     { dur: 90,  priority: 2 },
    shocked:    { dur: 80,  priority: 3 },
    money:      { dur: 110, priority: 3 },
    proud:      { dur: 90,  priority: 2 },
    relief:     { dur: 100, priority: 5 },
    thrust:     { dur: 60,  priority: 3 },
    sproing:    { dur: 50,  priority: 2 },
    dizzy:      { dur: 100, priority: 3 },
    annoyed:    { dur: 60,  priority: 2 },
    poppins:    { dur: 170, priority: 2 },
    panic:      { dur: 70,  priority: 4 },
    houston:    { dur: 120, priority: 4 },
    celebrate:  { dur: 110, priority: 3 },
    sleepy:     { dur: 150, priority: 1 },
    suspicious: { dur: 150, priority: 1 },
};

// Variant counts, matching FACES in blunday.js
const VARIANTS = { smile: 2, tongue: 2, proud: 2, relief: 2, sproing: 2, annoyed: 2, houston: 2, celebrate: 2 };

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// allowed(id): whether Blunday may show this emote at all (the ones equipped
// in the wardrobe)
export function createEmotes({ allowed } = {}) {
    let current = null;   // { id, age, dur, priority, variant, intensity, seed, held }
    let quiet = randInt(...QUIET_AFTER);
    let blinkIn = randInt(...BLINK_EVERY);
    let blinkLeft = 0;
    const lastSeen = {};  // emote id → frame it last started
    let frame = 0;

    // Asks for a reaction. opts: chance (0..1), intensity (0..1), priority,
    // dur, tint, force (skip the quiet spell and repeat guard).
    // Returns true if Blunday reacts.
    function trigger(id, opts = {}) {
        const def = DEFAULTS[id];
        if (!def || (allowed && !allowed(id))) return false;
        const priority = opts.priority ?? def.priority;
        if (current && current.priority >= priority) return false;
        if (!opts.force && !current) {
            if (quiet > 0) return false;
            if (lastSeen[id] !== undefined && frame - lastSeen[id] < SAME_EMOTE_GAP) return false;
        }
        if (Math.random() >= (opts.chance ?? 1)) return false;
        // Timing varies a little, so the same reaction never plays quite the same
        const dur = Math.round((opts.dur ?? def.dur) * (0.85 + Math.random() * 0.3));
        current = {
            id,
            age:       0,
            dur,
            priority,
            variant:   randInt(0, (VARIANTS[id] || 1) - 1),
            intensity: opts.intensity ?? 0.6,
            seed:      Math.random() * 1000,
            tint:      opts.tint,
            held:      false,
        };
        lastSeen[id] = frame;
        blinkLeft = 0;
        return true;
    }

    // Keeps a lasting mood going (e.g. the booster ride) instead of fading out
    function hold(id) {
        if (current && current.id === id) current.held = true;
    }

    function is(id) {
        return !!current && current.id === id;
    }

    // Ends the current emote early (it fades out quickly)
    function end(id) {
        if (current && (!id || current.id === id)) {
            current.held = false;
            current.age = Math.max(current.age, Math.round(current.dur * 0.85));
        }
    }

    function update() {
        frame++;
        if (current) {
            if (current.held) {
                // Pause in the middle of the emote until let go
                current.age = Math.min(current.age + 1, Math.round(current.dur * 0.5));
                current.held = false; // hold() must be called every step
            } else if (++current.age >= current.dur) {
                current = null;
                quiet = randInt(...QUIET_AFTER);
            }
        } else if (quiet > 0) {
            quiet--;
        }

        if (blinkLeft > 0) blinkLeft--;
        else if (--blinkIn <= 0) {
            blinkIn = randInt(...BLINK_EVERY);
            blinkLeft = BLINK_FRAMES;
        }
    }

    function reset() {
        current = null;
        quiet = randInt(...QUIET_AFTER);
        blinkLeft = 0;
    }

    return {
        trigger,
        hold,
        end,
        is,
        update,
        reset,
        get current() { return current; },
        get blinking() { return !current && blinkLeft > 0; },
        get calm() { return !current && quiet <= 0; },
    };
}
