import { ACHIEVEMENTS, isUnlocked as isAchievementUnlocked, subscribeUnlocks } from './achievements.js';
import { isExperimental, subscribeSettings } from './settings.js';

// Blunday's wardrobe: body colors, accessories (one per slot) and emotes (any
// number at once). Purely cosmetic, and part of Experimental Mode: with it off
// the Character screen is hidden and Blunday wears the default look, though
// unlocks are still earned and kept. Every item needs an unlock source except
// the defaults (Blunday Blue, each slot's None and the Smile). Achievements are
// the only source so far, one item each; an item with no source shows as
// "coming soon". A new source (a shop, say) only has to call grantItem() and
// describe itself in unlockHint().
const STORAGE_KEY = 'blundayWardrobe';

// Slots with one item each. Emotes are separate: several can be equipped.
export const SLOTS = Object.freeze(['color', 'hat', 'hair', 'glasses', 'face']);
export const TABS = Object.freeze([...SLOTS, 'emotes']);

export const SLOT_LABELS = Object.freeze({ color: 'Colors', hat: 'Hats', hair: 'Hair', glasses: 'Glasses', face: 'Face', emotes: 'Emotes' });

// light/dark: the body gradient (top left to bottom right), dark also shades the
// feet. ink: mouth and outline color, picked to read on that body.
export const COLORS = Object.freeze([
    { id: 'blue',   name: 'Blunday Blue',             light: '#66aaff', dark: '#2255bb', ink: '#334' },
    { id: 'red',    name: 'Angry Coin Red',           light: '#ff7a7a', dark: '#b8202e', ink: '#3a1018' },
    { id: 'gold',   name: 'Gold Digger Gold',         light: '#ffe27a', dark: '#c08a10', ink: '#4a3200', unlock: { achievement: 'gold_bar' }, shiny: true },
    { id: 'grey',   name: 'Monday Grey',              light: '#bcc2cc', dark: '#5c636e', ink: '#2a2e36', unlock: { achievement: 'no_gold_10000' } },
    { id: 'green',  name: 'Touch Grass Green',        light: '#86e682', dark: '#2e8a34', ink: '#163a18', unlock: { achievement: 'no_power_10000' } },
    { id: 'purple', name: 'Left Is Right Purple',     light: '#cf8dff', dark: '#6a2bb0', ink: '#2a0f4a' },
    { id: 'brown',  name: 'Termite Snack Brown',      light: '#cf9466', dark: '#6e3f1e', ink: '#2e1808' },
    { id: 'orange', name: 'Afterburner Orange',       light: '#ffb057', dark: '#d0520f', ink: '#4a1e00' },
    { id: 'pink',   name: 'Bubblegum Pink',           light: '#ffb3dc', dark: '#d9488f', ink: '#5a1438' },
    { id: 'white',  name: 'Moon Dust White',          light: '#ffffff', dark: '#bfc6d6', ink: '#334', paleEyes: true },
    { id: 'navy',   name: 'Deep Space Navy',          light: '#4a5c9e', dark: '#141c46', ink: '#dfe6ff' },
    { id: 'mint',   name: 'Mint Condition',           light: '#b4f5df', dark: '#3fb38c', ink: '#134a38', paleEyes: true },
    { id: 'yellow', name: 'Banana for Scale Yellow',  light: '#fff490', dark: '#e0b81a', ink: '#4a3a00', paleEyes: true },
    { id: 'peach',  name: 'Toe Bean Peach',           light: '#ffd8bd', dark: '#e58f72', ink: '#5a2a1a', paleEyes: true },
    { id: 'cyan',   name: 'Cyan-tifically Accurate',  light: '#7ef5ff', dark: '#1a9fc0', ink: '#0a3a4a' },
    { id: 'black',  name: 'Fell Too Far Black',       light: '#55555f', dark: '#141418', ink: '#e8e8f0' },
]);

// Accessories by slot. Drawing lives in blunday.js, keyed by id. Flags used
// there: tall (hair that squashes under a hat), dark (shades that hide the
// pupils).
export const ACCESSORIES = Object.freeze({
    hat: [
        { id: 'propeller', name: 'Propeller Cap' },
        { id: 'backwards', name: 'Backwards Cap',       unlock: { achievement: 'gold_bag' } },
        { id: 'tophat',    name: 'Top Hat',             unlock: { achievement: 'score_100000' } },
        { id: 'hardhat',   name: 'Hard Hat' },
        { id: 'crown',     name: 'Crown',               unlock: { achievement: 'all_maxed' } },
        { id: 'party',     name: 'Party Hat' },
        { id: 'beanie',    name: 'Pom-Pom Beanie' },
        { id: 'umbrellahat', name: 'Tiny Umbrella Hat' },
        { id: 'viking',    name: 'Viking Helmet' },
    ],
    hair: [
        { id: 'mullet',    name: 'Mullet',              unlock: { achievement: 'star_1000' } },
        { id: 'mohawk',    name: 'Mohawk',              tall: true },
        { id: 'spiky',     name: 'Spiky Anime Hair',    tall: true },
        { id: 'combover',  name: 'Fancy Combover' },
        { id: 'fluffy',    name: 'Big Fluffy Hair',     tall: true },
        { id: 'bowl',      name: 'Bowl Cut' },
        { id: 'single',    name: 'One Single Hair' },
    ],
    glasses: [
        { id: 'dealwithit', name: 'Deal With It Shades', unlock: { achievement: 'score_10000' }, dark: true },
        { id: 'starshades', name: 'Star Shades',         unlock: { achievement: 'star' } },
        { id: 'monocle',   name: 'Monocle',             unlock: { achievement: 'gold_100000' } },
        { id: 'nerd',      name: 'Taped Nerd Glasses' },
        { id: 'heart',     name: 'Heart Glasses' },
        { id: '3d',        name: '3D Glasses' },
        { id: 'ski',       name: 'Ski Goggles' },
    ],
    face: [
        { id: 'handlebar', name: 'Handlebar Mustache',  unlock: { achievement: 'score_30000' } },
        { id: 'pencil',    name: 'Pencil Mustache' },
        { id: 'walrus',    name: 'Walrus Mustache' },
        { id: 'goatee',    name: 'Goatee' },
        { id: 'gum',       name: 'Bubble Gum Bubble' },
        { id: 'rosy',      name: 'Rosy Cheeks' },
    ],
});

// Emotes Blunday may use. `reactions` are the ids in emotes.js the item
// enables (Panic → relief is one item for both halves). Equipped emotes fire
// the way they always do: now and then, when their moment comes.
export const EMOTES = Object.freeze([
    { id: 'smile',     name: 'Smile',                 reactions: ['smile'] },
    { id: 'thrust',    name: 'Thrust Issues Face',    reactions: ['thrust'],           unlock: { achievement: 'jetpack' } },
    { id: 'sproing',   name: 'Sproing Face',          reactions: ['sproing'],          unlock: { achievement: 'boots' } },
    { id: 'shocked',   name: 'Shocked Gem Face',      reactions: ['shocked'],          unlock: { achievement: 'red_gem' } },
    { id: 'annoyed',   name: 'Wood You Please Stop?', reactions: ['annoyed'],          unlock: { achievement: 'wood_1000' } },
    { id: 'panic',     name: 'Panic → Relief',        reactions: ['panic', 'relief'],  unlock: { achievement: 'jetpack_save' } },
    { id: 'houston',   name: 'Houston Face',          reactions: ['houston'],          unlock: { achievement: 'liftoff' } },
    { id: 'tongue',    name: 'Tongue Out',            reactions: ['tongue'] },
    { id: 'money',     name: 'Money Eyes',            reactions: ['money'] },
    { id: 'proud',     name: 'Proud Face',            reactions: ['proud'] },
    { id: 'dizzy',     name: 'Dizzy Face',            reactions: ['dizzy'] },
    { id: 'poppins',   name: 'Mary Poppins Face',     reactions: ['poppins'] },
    { id: 'celebrate', name: 'Celebration',           reactions: ['celebrate'] },
    { id: 'sleepy',    name: 'Sleepy Face',           reactions: ['sleepy'] },
]);

export const DEFAULT_LOOK = Object.freeze({ color: 'blue', hat: null, hair: null, glasses: null, face: null, emotes: Object.freeze(['smile']) });

const ALWAYS_UNLOCKED = new Set(['blue', 'smile']);

// Everything that can be unlocked (None doesn't count)
const ALL_ITEMS = [...COLORS, ...Object.values(ACCESSORIES).flat(), ...EMOTES];
export const TOTAL_ITEMS = ALL_ITEMS.length;

export function itemsForSlot(slot) {
    if (slot === 'emotes') return EMOTES;
    return slot === 'color' ? COLORS : ACCESSORIES[slot];
}

export function findItem(slot, id) {
    return itemsForSlot(slot).find(i => i.id === id) || null;
}

export function getColor(id) {
    return COLORS.find(c => c.id === id) || COLORS[0];
}

// ─── Persistence ────────────────────────────────────────────────────────────
function load() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (stored) {
            return {
                look:     { ...DEFAULT_LOOK, ...stored.look, emotes: Array.isArray(stored.look?.emotes) ? stored.look.emotes : [...DEFAULT_LOOK.emotes] },
                unlocked: Array.isArray(stored.unlocked) ? stored.unlocked : [],
            };
        }
    } catch (_) {}
    return { look: { ...DEFAULT_LOOK, emotes: [...DEFAULT_LOOK.emotes] }, unlocked: [] };
}

let state = load();
const subscribers = new Set();

function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    for (const fn of subscribers) fn(state.look);
}

export function subscribeWardrobe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

// Turning Experimental Mode on or off changes the look everyone sees
let wasExperimental = isExperimental();
subscribeSettings(() => {
    if (isExperimental() === wasExperimental) return;
    wasExperimental = isExperimental();
    for (const fn of subscribers) fn(state.look);
});

export function isWardrobeEnabled() {
    return isExperimental();
}

// ─── Unlocks ────────────────────────────────────────────────────────────────
// Unlocks an item from any source. Returns true if it was newly unlocked.
// A new emote is equipped straight away, so the player gets to see it.
export function grantItem(id) {
    if (state.unlocked.includes(id) || ALWAYS_UNLOCKED.has(id)) return false;
    state = { ...state, unlocked: [...state.unlocked, id] };
    if (EMOTES.some(e => e.id === id) && !state.look.emotes.includes(id)) {
        state = { ...state, look: { ...state.look, emotes: [...state.look.emotes, id] } };
    }
    save();
    return true;
}

export function isItemUnlocked(item) {
    if (!item) return true; // None
    if (ALWAYS_UNLOCKED.has(item.id) || state.unlocked.includes(item.id)) return true;
    // Also checked live, in case the achievement save is newer than this one
    return !!item.unlock?.achievement && isAchievementUnlocked(item.unlock.achievement);
}

export function countUnlocked() {
    return ALL_ITEMS.filter(isItemUnlocked).length;
}

// The item an achievement unlocks, if any
export function rewardForAchievement(achievementId) {
    return ALL_ITEMS.find(i => i.unlock?.achievement === achievementId) || null;
}

// How to get a locked item, for the Character screen
export function unlockHint(item) {
    const achievementId = item.unlock?.achievement;
    if (achievementId) {
        const def = ACHIEVEMENTS.find(a => a.id === achievementId);
        return { kind: 'achievement', title: def ? def.title : achievementId };
    }
    return { kind: 'soon' };
}

// Players who earned achievements before the wardrobe existed get their
// rewards right away, and new achievements grant theirs as they unlock
function syncAchievementRewards() {
    for (const a of ACHIEVEMENTS) {
        const reward = rewardForAchievement(a.id);
        if (reward && isAchievementUnlocked(a.id) && !state.unlocked.includes(reward.id)) {
            state = { ...state, unlocked: [...state.unlocked, reward.id] };
            // Emotes come switched on, as with a fresh unlock
            if (EMOTES.includes(reward) && !state.look.emotes.includes(reward.id)) {
                state = { ...state, look: { ...state.look, emotes: [...state.look.emotes, reward.id] } };
            }
        }
    }
}
syncAchievementRewards();
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}

subscribeUnlocks(def => {
    const reward = rewardForAchievement(def.id);
    if (reward) grantItem(reward.id);
});

// ─── Look ───────────────────────────────────────────────────────────────────
// The equipped look, falling back to the default for anything locked or unknown
export function getLook() {
    return state.look;
}

export function equip(slot, id) {
    const item = id === null ? null : findItem(slot, id);
    if (id !== null && (!item || !isItemUnlocked(item))) return;
    state = { ...state, look: { ...state.look, [slot]: id } };
    save();
}

// Emotes: any number can be on at once
export function toggleEmote(id) {
    const item = EMOTES.find(e => e.id === id);
    if (!item || !isItemUnlocked(item)) return;
    const on = state.look.emotes.includes(id);
    const emotes = on ? state.look.emotes.filter(e => e !== id) : [...state.look.emotes, id];
    state = { ...state, look: { ...state.look, emotes } };
    save();
}

// Accessories and color only; the emote picks are left as they are
export function randomizeLook() {
    const look = { emotes: state.look.emotes };
    for (const slot of SLOTS) {
        const options = itemsForSlot(slot).filter(isItemUnlocked).map(i => i.id);
        // Accessory slots can also come up empty, so not every look is fully loaded
        if (slot !== 'color') options.push(null);
        look[slot] = options[Math.floor(Math.random() * options.length)];
    }
    state = { ...state, look };
    save();
}

// The look to show. A saved look can name something that isn't unlocked (e.g.
// after a progress reset elsewhere); the default shows in its place. With
// Experimental Mode off it's the default look, unless `always` (the
// Character screen's own previews).
export function resolveLook(look = state.look, always = false) {
    if (!always && !isExperimental()) return DEFAULT_LOOK;
    const out = {};
    for (const slot of SLOTS) {
        const item = look[slot] ? findItem(slot, look[slot]) : null;
        out[slot] = item && isItemUnlocked(item) ? item.id : DEFAULT_LOOK[slot];
    }
    out.emotes = (look.emotes || []).filter(id => {
        const item = EMOTES.find(e => e.id === id);
        return !!item && isItemUnlocked(item);
    });
    return out;
}

// Whether the look lets Blunday show an emote (an emotes.js id)
export function allowsReaction(look, reaction) {
    return EMOTES.some(e => e.reactions.includes(reaction) && look.emotes?.includes(e.id));
}
