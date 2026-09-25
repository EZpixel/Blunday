import { getSettings, subscribeSettings } from './settings.js';

// Each sound lists its variants (files in public/sfx/). When a sound has more
// than one, a random variant is picked each time it starts.
const SOUNDS = Object.freeze({
    click:    ['Click'],
    upgrade:  ['Upgrade1'],
    boots:    ['Boots1', 'Boots2'],
    star:     ['Star1'],
    coin:     ['Coin1'],
    jump:     ['Jump1'],
    achievement: ['Achievement1', 'Achievement2', 'Achievement3', 'Achievement4'],
    jetpack:  ['Jetpack1'],
    umbrella: ['Umbrella1'],
    wood:     ['WoodPlatform1'],
    fall:     ['Fall1'],
    fart:     ['Fart'],
});

const LOOP_FADE_S = 0.08; // fade-out when a loop stops, so it doesn't pop

// Graph: sound -> sfx/music bus -> master -> speakers. The context starts
// suspended (browsers block audio until the first tap/key), but files can be
// decoded meanwhile so the first click already has its sound ready.
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = AudioCtx ? new AudioCtx() : null;
let masterGain, sfxGain, musicGain;
const buffers = {}; // name -> AudioBuffer[] (same order as SOUNDS)
const loops = {};   // name -> { source, gain } while playing

if (ctx) {
    masterGain = ctx.createGain();
    sfxGain    = ctx.createGain();
    musicGain  = ctx.createGain();
    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyVolumes(getSettings());
    subscribeSettings(applyVolumes);

    for (const [name, files] of Object.entries(SOUNDS)) {
        Promise.all(files.map(loadBuffer))
            .then(list => { buffers[name] = list; })
            .catch(() => {}); // a missing file just means that sound stays silent
    }

    const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
        window.addEventListener(type, resume, { capture: true, passive: true });
    }
}

async function loadBuffer(file) {
    const res = await fetch(`${import.meta.env.BASE_URL}sfx/${file}.wav`);
    if (!res.ok) throw new Error(`Missing sound: ${file}`);
    return ctx.decodeAudioData(await res.arrayBuffer());
}

function channelVolume(s, channel) {
    return s[`${channel}On`] ? s[`${channel}Volume`] : 0;
}

function applyVolumes(s) {
    masterGain.gain.value = channelVolume(s, 'master');
    sfxGain.gain.value    = channelVolume(s, 'sfx');
    musicGain.gain.value  = channelVolume(s, 'music');
}

function sfxAudible() {
    const s = getSettings();
    return channelVolume(s, 'master') > 0 && channelVolume(s, 'sfx') > 0;
}

// Picks a random variant index for a sound. Callers that need the same
// variant again (e.g. re-picking an active power-up) keep the index.
export function pickVariant(name) {
    const count = SOUNDS[name]?.length || 1;
    return Math.floor(Math.random() * count);
}

function getBuffer(name, variant) {
    const list = buffers[name];
    if (!list) return null;
    return list[variant ?? pickVariant(name)] || list[0];
}

export function playSfx(name, variant) {
    if (!ctx || !sfxAudible()) return;
    const buffer = getBuffer(name, variant);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start();
}

// Idempotent: call every tick with whether the loop should be playing. A loop
// that's already running keeps going (and keeps its variant).
export function setLoop(name, on) {
    if (!ctx) return;
    const current = loops[name];
    if (on && !current) {
        const buffer = getBuffer(name);
        if (!buffer) return;
        const gain   = ctx.createGain();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop   = true;
        source.connect(gain);
        gain.connect(sfxGain);
        source.start();
        loops[name] = { source, gain };
    } else if (!on && current) {
        const t = ctx.currentTime;
        current.gain.gain.setValueAtTime(current.gain.gain.value, t);
        current.gain.gain.linearRampToValueAtTime(0, t + LOOP_FADE_S);
        current.source.stop(t + LOOP_FADE_S);
        delete loops[name];
    }
}

export function stopAllLoops() {
    for (const name of Object.keys(loops)) setLoop(name, false);
}

// Button clicks anywhere in the UI. A button can override its sound with
// data-sfx="<name>", or opt out with data-sfx="none".
export function installClickSounds(root) {
    function onClick(e) {
        const button = e.target.closest?.('button');
        if (!button || button.disabled) return;
        const name = button.dataset.sfx || 'click';
        if (name !== 'none') playSfx(name);
    }
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
}
