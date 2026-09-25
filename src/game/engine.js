import { unlock } from './achievements.js';
import { getGold, addGold, getTotalEarned } from './wallet.js';
import { getMoveSpeedMultiplier, getPowerUpFreqMultiplier, getJetpackFuelMultiplier, getHigherJumpMultiplier, getBreakableGripLevel, hasBackupJetpack, hasBoosterLiftOff, getLuckCoinBonus, getStarGoldMultiplier, getUmbrellaFallReduction, areAllUpgradesMaxed } from './upgrades.js';
import { playSfx, pickVariant, setLoop, stopAllLoops } from './audio.js';
import { isExperimental } from './settings.js';
import { drawJetpackGlyph, drawBootsGlyph, drawStarGlyph, drawCoinGlyph, drawCoinBagGlyph, drawGoldBarGlyph, drawRedGemGlyph, drawUmbrellaGlyph } from './glyphs.js';

// ─── Coordinate Convention ───────────────────────────────────────────────────
// World-y increases DOWNWARD (standard canvas default).
// Ascending means decreasing y. cameraY starts at 0 and only ever
// decreases (moves up, never back down).
// screenY = worldY - cameraY
// score   = floor(-cameraY) + pickup bonuses
// Cull a platform when platform.y > cameraY + CANVAS_HEIGHT.
// Game over when player.y - cameraY > CANVAS_HEIGHT.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────
// The canvas is rendered at a phone-native 1080x2400 (9:20), but gameplay runs in
// a 400-unit-wide logical world so physics tuning is independent of resolution.
export const RENDER_WIDTH  = 1080;
export const RENDER_HEIGHT = 2400;
const CANVAS_WIDTH    = 400;
const RENDER_SCALE    = RENDER_WIDTH / CANVAS_WIDTH;
const CANVAS_HEIGHT   = RENDER_HEIGHT / RENDER_SCALE;
const GRAVITY         = 0.4;
const BOUNCE_VELOCITY = -12;
const PLAYER_WIDTH    = 40;
const PLAYER_HEIGHT   = 40;
const MOVE_SPEED      = 5;
const PLATFORM_HEIGHT = 12;
const PLATFORM_START_WIDTH     = 80;
const PLATFORM_PLAYER_WIDTH_SCORE = 30000;  // platforms are PLAYER_WIDTH wide here
const PLATFORM_MIN_WIDTH_SCORE    = 100000; // and half that from here on
const COIN_OFFSET_Y   = 20; // gold pickup center above its platform's top (glyphs reach ~10 below center)
const CAMERA_LINE     = 0.40 * CANVAS_HEIGHT;

// Power-up constants
const JETPACK_DURATION_FRAMES  = 120;
const BOOTS_DURATION_FRAMES    = 300;
const JETPACK_FORCE            = -0.8;   // upward accel per frame while active
const JETPACK_MAX_SPEED        = -14;    // max upward speed while jetpack on
const BOOTS_BOUNCE_VELOCITY    = -18;    // stronger bounce when boots active
const STAR_SCORE_BONUS         = 500;
const STAR_DURATION_FRAMES     = 300;
const UMBRELLA_DURATION_FRAMES = 300;

// Booster Ignition & Lift Off upgrade: twin rockets carry the player from the
// starter platform to BOOSTER_TARGET_SCORE at the start of every run
const BOOSTER_TARGET_SCORE    = 10000;
const BOOSTER_IGNITION_FRAMES = 50;    // rumbling on the pad before lift-off
const BOOSTER_FORCE           = -1.0;  // upward accel per frame once airborne
const BOOSTER_MAX_SPEED       = -30;
const BOOSTER_EXIT_SPEED      = JETPACK_MAX_SPEED; // speed left over when the boosters cut out
const BOOSTER_PACK_WIDTH      = 12;    // one pack strapped to each side of the player
const BOOSTER_PACK_HEIGHT     = 32;    // nose cone tip to nozzle exit

// Power-ups whose sound loops for as long as the effect is active
const LOOPED_EFFECT_SOUNDS = ['jetpack', 'umbrella'];
// Power-ups whose sound plays on each landing instead of at pickup
const LANDING_EFFECT_SOUNDS = ['boots'];

// Parallax background circles
const BG_CIRCLE_COUNT = 18;

export function createGame(canvas) {
    canvas.width  = RENDER_WIDTH;
    canvas.height = RENDER_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0); // draw in logical units

    // ─── Mutable state ────────────────────────────────────────────────────────
    let gameState = 'idle';
    let player;
    let platforms;
    let cameraY;
    let score;
    let scoreBonus;    // points from pickups, added on top of the height reached
    let coins;
    let activeEffects; // { [type]: { type, remaining, total } }
    let particles;     // [{ x, y, vx, vy, life, maxLife, size, color, kind }]
    let rafId = null;
    let justUnlocked = [];
    let scoreAchAwarded = false;
    let score30kAchAwarded = false;
    let score100kAchAwarded = false;
    let richAchAwarded = false; // skips further checks once unlocked this session
    let moveSpeedMultiplier = 1;
    let jetpackDurationMultiplier = 1;
    let starGoldMultiplier = 1;
    let umbrellaFallReduction = 0;
    let bounceVelocity = BOUNCE_VELOCITY;
    let bootsBounceVelocity = BOOTS_BOUNCE_VELOCITY;
    let breakableExtraLandings = 0;
    let backupJetpackArmed = false;
    let justSaved = false;
    let shake = 0; // screen shake amplitude in logical units
    let flash = 0; // full-screen white flash, 0..1
    const gaze = { x: 0, y: 0 }; // pupil direction, each axis -1..1
    const effectSoundVariant = {}; // one-shot power-up sound variant, kept while the effect is active

    // Parallax background circles (seeded once, not reset each run)
    const bgCircles = Array.from({ length: BG_CIRCLE_COUNT }, () => ({
        x:       Math.random() * CANVAS_WIDTH,
        yOffset: Math.random() * CANVAS_HEIGHT * 3, // offset in world space
        radius:  4 + Math.random() * 14,
        opacity: 0.04 + Math.random() * 0.10,
        speed:   0.05 + Math.random() * 0.08,
    }));

    // ─── High score ───────────────────────────────────────────────────────────
    let highScore = 0;
    try {
        const stored = localStorage.getItem('blundayHighScore');
        if (stored !== null) highScore = parseInt(stored, 10) || 0;
    } catch (_) {}

    // ─── Pub-sub ──────────────────────────────────────────────────────────────
    const subscribers = new Set();

    // In-memory copy of the wallet so emits don't hit localStorage every frame.
    // Refreshed on reset(); updated whenever this engine adds gold.
    let gold = getGold();

    function emit() {
        const snap = {
            gameState,
            score,
            highScore,
            coins,
            activeEffects: effectsSnapshot(),
            justUnlocked,
            gold,
            justSaved,
        };
        lastEmitKey = snapshotKey();
        for (const fn of subscribers) fn(snap);
        justUnlocked = []; // each unlock visible in exactly one emitted snapshot
        justSaved = false; // save toast fires for exactly one snapshot
    }

    // Cheap fingerprint of everything the UI shows. Effect bars are quantised to
    // 0.5% so they still animate smoothly without re-rendering React every frame.
    let lastEmitKey = '';
    function snapshotKey() {
        let key = `${gameState}|${score}|${highScore}|${coins}|${gold}|${justUnlocked.length}|${justSaved}`;
        for (const t in activeEffects) {
            const e = activeEffects[t];
            key += `|${t}:${Math.ceil((e.remaining / e.total) * 200)}`;
        }
        return key;
    }

    // Called once per rendered frame (not per physics step): only notify React
    // when something visible actually changed.
    function emitIfChanged() {
        if (snapshotKey() !== lastEmitKey) emit();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function goldDistribution(s) {
        const V10  = [0.70, 0.30, 0,    0];
        const V30  = [0.30, 0.30, 0.40, 0];    // red gems only start appearing past 30k
        const V100 = [0,    0,    0,    1];
        if (s < 10000) return [1, 0, 0, 0];
        if (s <= 30000) {
            const t = (s - 10000) / 20000;
            return V10.map((v, i) => lerp(v, V30[i], t));
        }
        if (s <= 100000) {
            const t = (s - 30000) / 70000;
            return V30.map((v, i) => lerp(v, V100[i], t));
        }
        return V100;
    }

    const GOLD_TYPES = [
        { type: 'coin', amount: 1   },
        { type: 'bag',  amount: 5   },
        { type: 'bar',  amount: 50  },
        { type: 'gem',  amount: 100 },
    ];

    function pickGoldType(s) {
        const dist = goldDistribution(s);
        const roll = Math.random();
        let acc = 0;
        for (let i = 0; i < GOLD_TYPES.length; i++) {
            acc += dist[i];
            if (roll < acc) return GOLD_TYPES[i];
        }
        return GOLD_TYPES[0];
    }

    // Power-up hierarchy: only one of these can be active at a time. Picking up a
    // higher- or equal-ranked one replaces the active one; a lower-ranked one
    // can't be picked up. Star isn't listed, so it combines with any of them.
    const EXCLUSIVE_RANK = { umbrella: 1, boots: 2, jetpack: 3, booster: 4 };

    function activeExclusiveEffect() {
        for (const t in EXCLUSIVE_RANK) if (activeEffects[t]) return t;
        return null;
    }

    function clearExclusiveEffects() {
        for (const t in EXCLUSIVE_RANK) delete activeEffects[t];
    }

    // Looped sounds are driven by the effect tick and landing sounds by
    // checkLanding(). One-shots pick a random variant per activation, and
    // re-picking an active power-up reuses it.
    function playPowerUpSound(type, alreadyActive) {
        if (LOOPED_EFFECT_SOUNDS.includes(type)) return;
        if (!alreadyActive || effectSoundVariant[type] === undefined) effectSoundVariant[type] = pickVariant(type);
        if (LANDING_EFFECT_SOUNDS.includes(type)) return;
        playSfx(type, effectSoundVariant[type]);
    }

    function effectsSnapshot() {
        const order = ['booster', 'jetpack', 'boots', 'umbrella', 'star'];
        return order
            .filter(t => activeEffects[t])
            .map(t => ({ type: t, remaining: activeEffects[t].remaining, total: activeEffects[t].total }));
    }

    // ─── Difficulty ───────────────────────────────────────────────────────────
    // Platforms shrink smoothly with height: to the player's width at
    // PLATFORM_PLAYER_WIDTH_SCORE, then to half of it at PLATFORM_MIN_WIDTH_SCORE,
    // and stay there.
    function platformWidth(s) {
        s = Math.max(s, 0);
        if (s <= PLATFORM_PLAYER_WIDTH_SCORE) {
            return Math.round(lerp(PLATFORM_START_WIDTH, PLAYER_WIDTH, s / PLATFORM_PLAYER_WIDTH_SCORE));
        }
        const t = Math.min((s - PLATFORM_PLAYER_WIDTH_SCORE) / (PLATFORM_MIN_WIDTH_SCORE - PLATFORM_PLAYER_WIDTH_SCORE), 1);
        return Math.round(lerp(PLAYER_WIDTH, PLAYER_WIDTH / 2, t));
    }

    function getDifficulty(s) {
        if (s >= 5000) {
            return { gapMin: 105, gapMax: 120, movingChance: 0.45, breakChance: 0.25,
                     powerUpChance: 0.097, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 3, starWeight: 5, umbrellaWeight: 3 };
        } else if (s >= 3000) {
            return { gapMin: 100, gapMax: 115, movingChance: 0.35, breakChance: 0.15,
                     powerUpChance: 0.072, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else if (s >= 1500) {
            return { gapMin: 90,  gapMax: 110, movingChance: 0.20, breakChance: 0.00,
                     powerUpChance: 0.05, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else if (s >= 500) {
            return { gapMin: 80,  gapMax: 100, movingChance: 0.00, breakChance: 0.00,
                     powerUpChance: 0.04, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else {
            return { gapMin: 70,  gapMax: 90, movingChance: 0.00, breakChance: 0.00,
                     powerUpChance: 0.04, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        }
    }

    // ─── Particle system ──────────────────────────────────────────────────────
    function spawnParticles(kind, x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            particles.push({
                x,
                y,
                vx:      Math.cos(angle) * speed,
                vy:      Math.sin(angle) * speed,
                life:    20 + Math.random() * 20,
                maxLife: 40,
                size:    2 + Math.random() * 3,
                kind,
            });
        }
    }

    // Single particle with its own physics: gravity (default 0.1) and drag (velocity kept per frame)
    function emitParticle(kind, x, y, vx, vy, life, size, gravity = 0.1, drag = 1) {
        particles.push({ x, y, vx, vy, life, maxLife: life, size, kind, gravity, drag });
    }

    // ─── Booster ──────────────────────────────────────────────────────────────
    // The packs hang centered on the (squashed) body, see draw(); particles
    // leave from the same nozzle spots.
    function playerStretch(velocityY) {
        return Math.max(0.7, Math.min(1.3, 1 + velocityY * 0.02));
    }

    function boosterPackTop(bodyY, bodyH) {
        return bodyY + bodyH / 2 - BOOSTER_PACK_HEIGHT / 2;
    }

    function boosterNozzles() {
        const bodyH = PLAYER_HEIGHT * playerStretch(player.velocityY);
        const y = boosterPackTop(player.y + PLAYER_HEIGHT - bodyH, bodyH) + BOOSTER_PACK_HEIGHT;
        return [player.x - BOOSTER_PACK_WIDTH / 2, player.x + PLAYER_WIDTH + BOOSTER_PACK_WIDTH / 2].map(x => ({ x, y }));
    }

    function igniteBooster() {
        activeEffects.booster = {
            type:      'booster',
            remaining: BOOSTER_TARGET_SCORE,
            total:     BOOSTER_TARGET_SCORE,
            ignition:  BOOSTER_IGNITION_FRAMES,
        };
    }

    function burst(x, y, sparks, smokes) {
        for (let i = 0; i < sparks; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = randRange(2, 9);
            emitParticle('spark', x, y, Math.cos(a) * v, Math.sin(a) * v, randRange(25, 50), randRange(1.5, 3.5), 0.15, 0.97);
        }
        for (let i = 0; i < smokes; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = randRange(1, 5);
            emitParticle('smoke', x, y, Math.cos(a) * v, Math.sin(a) * v * 0.4, randRange(40, 70), randRange(8, 16), -0.02, 0.94);
        }
        emitParticle('ring', x, y, 0, 0, 30, 90, 0);
    }

    function liftOff() {
        const feetY = player.y + PLAYER_HEIGHT;
        burst(player.x + PLAYER_WIDTH / 2, feetY, 60, 40);
        flash = 0.8;
        shake = 6;
        playSfx('jetpack');
    }

    function boosterCutOff() {
        delete activeEffects.booster;
        player.velocityY = Math.max(player.velocityY, BOOSTER_EXIT_SPEED);
        for (const n of boosterNozzles()) burst(n.x, n.y, 30, 10);
        flash = 0.45;
        shake = 5;
        tryUnlock('liftoff');
    }

    function emitBoosterParticles(booster) {
        const spool = 1 - booster.ignition / BOOSTER_IGNITION_FRAMES; // 0 → 1 while on the pad
        const airborne = booster.ignition === 0;
        for (const n of boosterNozzles()) {
            const flames = airborne ? 4 : Math.round(1 + spool * 3);
            for (let i = 0; i < flames; i++) {
                const vy = airborne ? player.velocityY + randRange(6, 11) : randRange(2, 5) * (0.5 + spool);
                emitParticle('flame', n.x + randRange(-3, 3), n.y + randRange(0, 6), randRange(-0.8, 0.8), vy,
                             randRange(14, 24), randRange(7, 13), 0);
            }
            if (airborne) {
                // Smoke trail lags far behind the rocket
                if (Math.random() < 0.7) {
                    emitParticle('smoke', n.x + randRange(-4, 4), n.y + 10, randRange(-1.5, 1.5), player.velocityY * 0.35,
                                 randRange(30, 45), randRange(6, 11), 0, 0.98);
                }
            } else if (Math.random() < 0.3 + spool * 0.6) {
                // Exhaust hitting the pad billows out sideways
                const side = n.x < player.x ? -1 : 1;
                emitParticle('smoke', n.x, n.y + 8, side * randRange(1.5, 5), randRange(-1, 0), randRange(45, 75),
                             randRange(6, 12), -0.02, 0.95);
            }
            if (Math.random() < (airborne ? 0.6 : spool * 0.5)) {
                emitParticle('spark', n.x, n.y + 4, randRange(-3, 3), (airborne ? player.velocityY * 0.5 : 0) + randRange(1, 5),
                             randRange(15, 30), randRange(1, 2.5), 0.15);
            }
        }
        // Speed lines rushing past the screen
        if (airborne) {
            for (let i = 0; i < 2; i++) {
                emitParticle('streak', Math.random() * CANVAS_WIDTH, cameraY + Math.random() * CANVAS_HEIGHT, 0, 0,
                             randRange(6, 12), randRange(20, 50), 0);
            }
        }
        shake = Math.max(shake, airborne ? 2 : spool * 3.5);
    }

    // ─── Spawn ────────────────────────────────────────────────────────────────
    function spawnPlatformAbove(topmostY) {
        const diff  = getDifficulty(score);
        const newY  = topmostY - randInt(diff.gapMin, diff.gapMax);
        const width = platformWidth(score);
        const x     = randInt(0, CANVAS_WIDTH - width);

        let type = 'static';
        let vx;
        let broken;

        if (Math.random() < diff.movingChance) {
            type = 'moving';
            vx   = (Math.random() < 0.5 ? -1 : 1) * randRange(1, 2);
        } else if (Math.random() < diff.breakChance) {
            type   = 'breakable';
            broken = false;
        }

        const platform = { x, y: newY, width, type };
        if (type === 'moving')    platform.vx = vx;
        if (type === 'breakable') {
            platform.broken = false;
            platform.landingsLeft = 1 + breakableExtraLandings;
        }

        // Power-ups: static platforms only (amendment #1)
        const effectiveChance = Math.min(diff.powerUpChance * getPowerUpFreqMultiplier(), 0.5);
        if (type === 'static' && Math.random() < effectiveChance) {
            const { jetpackWeight, bootsWeight, starWeight, umbrellaWeight } = diff;
            const total = jetpackWeight + bootsWeight + starWeight + umbrellaWeight;
            const roll  = Math.random() * total;
            let puType;
            if (roll < jetpackWeight) {
                puType = 'jetpack';
            } else if (roll < jetpackWeight + bootsWeight) {
                puType = 'boots';
            } else if (roll < jetpackWeight + bootsWeight + starWeight) {
                puType = 'star';
            } else {
                puType = 'umbrella';
            }
            platform.powerUp = { type: puType, collected: false };
        }

        // Coins: static and moving platforms only, and never alongside a power-up (only one pickup per platform)
        if ((type === 'static' || type === 'moving') && !platform.powerUp) {
            const coinChance = Math.min(0.18 + getLuckCoinBonus(), 0.5);
            if (Math.random() < coinChance) {
                const g = pickGoldType(score);
                platform.coin = { type: g.type, amount: g.amount, collected: false };
            }
        }

        platforms.push(platform);
        return platform;
    }

    // ─── Achievement helper ───────────────────────────────────────────────────
    function tryUnlock(id) { const def = unlock(id); if (def) justUnlocked.push(def); }

    // ─── Reset ────────────────────────────────────────────────────────────────
    function reset() {
        cameraY         = 0;
        prevCameraY     = 0;
        score           = 0;
        scoreBonus      = 0;
        coins           = 0;
        activeEffects   = {};
        particles       = [];
        justUnlocked    = [];
        shake           = 0;
        flash           = 0;
        stopAllLoops();
        gold            = getGold(); // upgrades bought in the menu may have spent gold
        dragTargetX     = null;
        gaze.x          = 0;
        gaze.y          = 0;
        scoreAchAwarded           = false;
        score30kAchAwarded        = false;
        score100kAchAwarded       = false;
        backupJetpackArmed        = hasBackupJetpack();
        moveSpeedMultiplier       = getMoveSpeedMultiplier();
        jetpackDurationMultiplier = getJetpackFuelMultiplier();
        starGoldMultiplier        = getStarGoldMultiplier();
        umbrellaFallReduction     = getUmbrellaFallReduction();
        bounceVelocity            = BOUNCE_VELOCITY * getHigherJumpMultiplier();
        bootsBounceVelocity       = BOOTS_BOUNCE_VELOCITY * getHigherJumpMultiplier();
        breakableExtraLandings    = getBreakableGripLevel();

        const starterWidth = platformWidth(0);
        const starterX     = Math.floor((CANVAS_WIDTH - starterWidth) / 2);
        const starterY     = CANVAS_HEIGHT - 40;

        const starterPlatform = {
            x:     starterX,
            y:     starterY,
            width: starterWidth,
            type:  'static',
        };

        platforms = [starterPlatform];

        player = {
            x:         Math.floor((CANVAS_WIDTH - PLAYER_WIDTH) / 2),
            y:         starterPlatform.y - PLAYER_HEIGHT,
            velocityY: 0,
        };

        let topmostY = starterPlatform.y;
        while (topmostY >= cameraY - CANVAS_HEIGHT) {
            const p = spawnPlatformAbove(topmostY);
            topmostY = p.y;
        }

        if (areAllUpgradesMaxed()) tryUnlock('all_maxed');
        emit(); // amendment #2: emit after reset so HUD clears immediately
    }

    // ─── Input ────────────────────────────────────────────────────────────────
    const input = { left: false, right: false };
    let dragTargetX = null;

    function setInput(left, right) {
        input.left  = left;
        input.right = right;
    }

    function setDragTargetFromClient(clientX, rectLeft, rectWidth) {
        if (!rectWidth) return;
        const scale = CANVAS_WIDTH / rectWidth;
        dragTargetX = (clientX - rectLeft) * scale;
    }

    function clearDragTarget() {
        dragTargetX = null;
    }

    // ─── Physics Helpers ──────────────────────────────────────────────────────
    function moveHorizontal() {
        const step = MOVE_SPEED * moveSpeedMultiplier;

        if (dragTargetX !== null) {
            const playerCenter = player.x + PLAYER_WIDTH / 2;
            const delta = dragTargetX - playerCenter;
            player.x += Math.sign(delta) * Math.min(Math.abs(delta), step);
        } else {
            if (input.left)  player.x -= step;
            if (input.right) player.x += step;
        }

        if (player.x + PLAYER_WIDTH < 0) player.x = CANVAS_WIDTH;
        if (player.x > CANVAS_WIDTH)     player.x = -PLAYER_WIDTH;
    }

    function checkLanding(prevBottom, currBottom) {
        for (const platform of platforms) {
            if (platform.broken) continue;

            const fallingDown   = player.velocityY > 0;
            const crossedTop    = prevBottom <= platform.y && currBottom >= platform.y;
            const horizontalHit =
                player.x + PLAYER_WIDTH > platform.x &&
                player.x < platform.x + platform.width;

            if (fallingDown && crossedTop && horizontalHit) {
                player.y = platform.y - PLAYER_HEIGHT;

                // Boots effect: stronger bounce
                if (activeEffects.boots) {
                    player.velocityY = bootsBounceVelocity;
                } else {
                    player.velocityY = bounceVelocity;
                }

                if (platform.type === 'breakable') {
                    platform.landingsLeft = (platform.landingsLeft !== undefined ? platform.landingsLeft : 1) - 1;
                    if (platform.landingsLeft <= 0) {
                        platform.broken = true;
                    }
                }
                // Boots replace the jump sound (with the variant locked at pickup)
                // and still play alongside the breaking-wood sound.
                if (platform.broken) playSfx('wood');
                if (activeEffects.boots) playSfx('boots', effectSoundVariant.boots);
                else if (!platform.broken) playSfx('jump');

                return platform;
            }
        }
        return null;
    }

    // ─── Gaze ─────────────────────────────────────────────────────────────────
    // The eyes track the nearest gold pickup in range; with none around they
    // glance up while rising and down while falling. Eased so they glide.
    const GAZE_RANGE = 320;
    const GAZE_EASE  = 0.15;

    function updateGaze() {
        const eyeX = player.x + PLAYER_WIDTH / 2;
        const eyeY = player.y + 14;
        let targetX = 0;
        let targetY = Math.max(-0.6, Math.min(0.6, player.velocityY * 0.06));
        let bestDist = GAZE_RANGE * GAZE_RANGE;
        for (const p of platforms) {
            if (!p.coin || p.coin.collected) continue;
            const dx = p.x + p.width / 2 - eyeX;
            const dy = p.y - COIN_OFFSET_Y - eyeY;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                const len = Math.sqrt(dist) || 1;
                targetX = dx / len;
                targetY = dy / len;
            }
        }
        gaze.x += (targetX - gaze.x) * GAZE_EASE;
        gaze.y += (targetY - gaze.y) * GAZE_EASE;
    }

    // ─── Update ───────────────────────────────────────────────────────────────
    function update() {
        moveHorizontal();
        updateGaze();

        // Move moving platforms
        for (const p of platforms) {
            if (p.type !== 'moving') continue;
            p.x += p.vx;
            if (p.x <= 0) {
                p.x  = 0;
                p.vx = -p.vx;
            } else if (p.x + p.width >= CANVAS_WIDTH) {
                p.x  = CANVAS_WIDTH - p.width;
                p.vx = -p.vx;
            }
        }

        // Power-up collection: AABB check each frame
        // Jetpack, boots and umbrella are mutually exclusive (see EXCLUSIVE_RANK);
        // star stacks with anything.
        for (const p of platforms) {
            if (!p.powerUp || p.powerUp.collected) continue;
            const puX = p.x + p.width / 2 - 12; // centered 24px wide
            const puY = p.y - 28;
            const puW = 24;
            const puH = 24;

            const overlap =
                player.x < puX + puW &&
                player.x + PLAYER_WIDTH > puX &&
                player.y < puY + puH &&
                player.y + PLAYER_HEIGHT > puY;

            if (overlap) {
                const alreadyActive = !!activeEffects[p.powerUp.type];
                const rank = EXCLUSIVE_RANK[p.powerUp.type];
                if (rank) {
                    // A stronger active power-up blocks the pickup; it stays on the platform
                    const current = activeExclusiveEffect();
                    if (current && EXCLUSIVE_RANK[current] > rank) continue;
                    clearExclusiveEffects(); // equal or weaker: replaced by the new one
                }
                p.powerUp.collected = true;
                playPowerUpSound(p.powerUp.type, alreadyActive);
                if (p.powerUp.type === 'jetpack') {
                    const dur = Math.round(JETPACK_DURATION_FRAMES * jetpackDurationMultiplier);
                    activeEffects.jetpack = { type: 'jetpack', remaining: dur, total: dur };
                    spawnParticles('pickup', player.x + PLAYER_WIDTH / 2, player.y, 8);
                    tryUnlock('jetpack');
                } else if (p.powerUp.type === 'boots') {
                    activeEffects.boots = { type: 'boots', remaining: BOOTS_DURATION_FRAMES, total: BOOTS_DURATION_FRAMES };
                    spawnParticles('pickup', player.x + PLAYER_WIDTH / 2, player.y, 8);
                    tryUnlock('boots');
                } else if (p.powerUp.type === 'star') {
                    scoreBonus += STAR_SCORE_BONUS;
                    score      += STAR_SCORE_BONUS;
                    coins++;
                    activeEffects.star = { type: 'star', remaining: STAR_DURATION_FRAMES, total: STAR_DURATION_FRAMES };
                    spawnParticles('pickup', player.x + PLAYER_WIDTH / 2, player.y, 12);
                    tryUnlock('star');
                } else if (p.powerUp.type === 'umbrella') {
                    activeEffects.umbrella = { type: 'umbrella', remaining: UMBRELLA_DURATION_FRAMES, total: UMBRELLA_DURATION_FRAMES };
                    spawnParticles('pickup', player.x + PLAYER_WIDTH / 2, player.y, 8);
                }
            }
        }

        // Coin collection: AABB check each frame
        for (const p of platforms) {
            if (!p.coin || p.coin.collected) continue;
            const coinX = p.x + p.width / 2 - 10; // centered 20px wide
            const coinY = p.y - COIN_OFFSET_Y - 10;
            const coinW = 20;
            const coinH = 20;

            const coinOverlap =
                player.x < coinX + coinW &&
                player.x + PLAYER_WIDTH > coinX &&
                player.y < coinY + coinH &&
                player.y + PLAYER_HEIGHT > coinY;

            if (coinOverlap) {
                p.coin.collected = true;
                const gain = activeEffects.star ? Math.round(p.coin.amount * starGoldMultiplier) : p.coin.amount;
                gold = addGold(gain);
                playSfx('coin');
                spawnParticles('pickup', player.x + PLAYER_WIDTH / 2, player.y, 6);
                if (p.coin.type === 'bag')      tryUnlock('gold_bag');
                else if (p.coin.type === 'bar') tryUnlock('gold_bar');
                else if (p.coin.type === 'gem') tryUnlock('red_gem');
                if (!richAchAwarded && getTotalEarned() >= 100000) { richAchAwarded = true; tryUnlock('gold_100000'); }
            }
        }

        const prevBottom = player.y + PLAYER_HEIGHT;

        // Booster and jetpack override gravity
        const booster = activeEffects.booster;
        if (booster) {
            if (booster.ignition > 0) {
                // Engines spooling up: held on the pad
                player.velocityY = 0;
                booster.ignition--;
                if (booster.ignition === 0) liftOff();
            } else {
                player.velocityY = Math.max(player.velocityY + BOOSTER_FORCE, BOOSTER_MAX_SPEED);
                player.y += player.velocityY;
            }
            emitBoosterParticles(booster);
        } else if (activeEffects.jetpack) {
            player.velocityY = Math.max(player.velocityY + JETPACK_FORCE, JETPACK_MAX_SPEED);
            player.y += player.velocityY;
            // Exhaust particles at the bottom of the player
            if (Math.random() < 0.6) {
                spawnParticles('exhaust', player.x + PLAYER_WIDTH / 2, player.y + PLAYER_HEIGHT, 2);
            }
        } else {
            player.velocityY += GRAVITY;
            if (activeEffects.umbrella && player.velocityY > 0) {
                player.y += player.velocityY * (1 - umbrellaFallReduction);
            } else {
                player.y += player.velocityY;
            }
        }

        const currBottom = player.y + PLAYER_HEIGHT;

        checkLanding(prevBottom, currBottom);

        // Camera follows ascent only
        const targetCameraY = player.y - CAMERA_LINE;
        if (targetCameraY < cameraY) cameraY = targetCameraY;

        // cameraY only ever decreases, so height (and with it score) never drops
        score     = Math.floor(-cameraY) + scoreBonus;
        highScore = Math.max(highScore, score);

        if (score >= 10000 && !scoreAchAwarded) { scoreAchAwarded = true; tryUnlock('score_10000'); }
        if (score >= 30000 && !score30kAchAwarded) { score30kAchAwarded = true; tryUnlock('score_30000'); }
        if (score >= 100000 && !score100kAchAwarded) { score100kAchAwarded = true; tryUnlock('score_100000'); }

        // Booster bar drains with the distance still to go
        if (booster && booster.ignition === 0) {
            booster.remaining = Math.max(0, BOOSTER_TARGET_SCORE - score);
            if (booster.remaining === 0) boosterCutOff();
        }

        // Spawn new platforms
        let topmostY = Math.min(...platforms.map(p => p.y));
        while (topmostY >= cameraY - CANVAS_HEIGHT) {
            const p = spawnPlatformAbove(topmostY);
            topmostY = p.y;
        }

        // Cull off-screen and broken platforms
        platforms = platforms.filter(
            p => p.y <= cameraY + CANVAS_HEIGHT && p.broken !== true
        );

        // Tick active effects
        for (const key of Object.keys(activeEffects)) {
            if (key === 'booster') continue; // ticks by score, above
            activeEffects[key].remaining--;
            if (activeEffects[key].remaining <= 0) delete activeEffects[key];
        }
        // The booster roars with the jetpack's loop
        for (const type of LOOPED_EFFECT_SOUNDS) setLoop(type, !!activeEffects[type] || (type === 'jetpack' && !!activeEffects.booster));

        shake *= 0.9;
        flash *= 0.9;

        // Star: gold sparkles drifting off the player
        if (activeEffects.star && Math.random() < 0.25) {
            spawnParticles('pickup', player.x + Math.random() * PLAYER_WIDTH, player.y + Math.random() * PLAYER_HEIGHT, 1);
        }

        // Update particles
        particles = particles.filter(part => {
            part.x    += part.vx;
            part.y    += part.vy;
            if (part.drag !== undefined) {
                part.vx *= part.drag;
                part.vy *= part.drag;
            }
            part.vy   += part.gravity ?? 0.1; // light gravity on particles by default
            part.life--;
            return part.life > 0;
        });

        // Game over / jetpack save
        if (player.y - cameraY > CANVAS_HEIGHT) {
            if (backupJetpackArmed) {
                backupJetpackArmed = false;
                justSaved = true;
                clearExclusiveEffects(); // jetpack outranks boots/umbrella
                const dur = Math.round(JETPACK_DURATION_FRAMES * jetpackDurationMultiplier);
                activeEffects.jetpack = { type: 'jetpack', remaining: dur, total: dur };
                player.velocityY = JETPACK_MAX_SPEED;
                spawnParticles('exhaust', player.x + PLAYER_WIDTH / 2, player.y + PLAYER_HEIGHT, 12);
                tryUnlock('jetpack_save');
            } else {
                gameState = 'gameover';
                stopAllLoops();
                playSfx(isExperimental() ? 'fart' : 'fall');
                try { localStorage.setItem('blundayHighScore', String(highScore)); } catch (_) {}
            }
        }
    }

    // ─── Drawing helpers ──────────────────────────────────────────────────────

    function drawRoundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
    }

    function drawStar(cx, cy, outerR, innerR, points, color) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle  = (i * Math.PI) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? outerR : innerR;
            const px     = cx + Math.cos(angle) * radius;
            const py     = cy + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else         ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Glyphs are static, so each is drawn once onto an offscreen canvas and then
    // blitted with drawImage. Redrawing them every frame (paths, gradients and
    // fillText) was a large share of frame time on Firefox for Android.
    // Sprites are rasterised at render resolution so they stay sharp when scaled.
    // Sprites are rasterised at render resolution so they stay sharp when scaled.
    const SPRITE_SIZE = 48; // glyphs extend at most ~16px from their center
    const SPRITE_PIXELS = Math.ceil(SPRITE_SIZE * RENDER_SCALE);
    function makeSprite(drawGlyph) {
        const sprite = document.createElement('canvas');
        sprite.width  = SPRITE_PIXELS;
        sprite.height = SPRITE_PIXELS;
        const sctx = sprite.getContext('2d');
        sctx.scale(SPRITE_PIXELS / SPRITE_SIZE, SPRITE_PIXELS / SPRITE_SIZE);
        drawGlyph(sctx, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
        return sprite;
    }
    const SPRITES = {
        jetpack:  makeSprite(drawJetpackGlyph),
        boots:    makeSprite(drawBootsGlyph),
        star:     makeSprite(drawStarGlyph),
        umbrella: makeSprite(drawUmbrellaGlyph),
        coin:     makeSprite(drawCoinGlyph),
        bag:      makeSprite(drawCoinBagGlyph),
        bar:      makeSprite(drawGoldBarGlyph),
        gem:      makeSprite(drawRedGemGlyph),
    };

    // Soft radial glows, pre-rendered once because building a radial gradient
    // every frame is slow on mobile browsers. rgb is "r,g,b".
    function makeGlowSprite(size, rgb, strength) {
        const glow = document.createElement('canvas');
        glow.width  = Math.ceil(size * RENDER_SCALE);
        glow.height = glow.width;
        const gctx = glow.getContext('2d');
        const r    = glow.width / 2;
        const grad = gctx.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0,    `rgba(${rgb},${strength})`);
        grad.addColorStop(0.45, `rgba(${rgb},${strength * 0.45})`);
        grad.addColorStop(1,    `rgba(${rgb},0)`);
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, glow.width, glow.height);
        return glow;
    }

    // Star power-up aura around the player
    const GLOW_SIZE  = 110;
    const glowSprite = makeGlowSprite(GLOW_SIZE, '255,210,60', 0.75);

    // Pickup glows on platforms: every power-up and the red gem, in its own color
    const PICKUP_GLOW_SIZE = 46;
    const PICKUP_GLOWS = {
        jetpack:  makeGlowSprite(PICKUP_GLOW_SIZE, '255,120,50',  0.6),
        boots:    makeGlowSprite(PICKUP_GLOW_SIZE, '180,110,255', 0.6),
        umbrella: makeGlowSprite(PICKUP_GLOW_SIZE, '255,90,170',  0.6),
        star:     makeGlowSprite(PICKUP_GLOW_SIZE, '255,215,60',  0.6),
        gem:      makeGlowSprite(PICKUP_GLOW_SIZE, '255,50,50',   0.6),
    };

    // Booster fire: additive glow blobs are much cheaper than per-particle gradients
    const FLAME_HOT_SPRITE  = makeGlowSprite(32, '200,235,255', 1);
    const FLAME_FIRE_SPRITE = makeGlowSprite(32, '255,130,40',  1);
    const NOZZLE_GLOW_SIZE  = 70;
    const nozzleGlowSprite  = makeGlowSprite(NOZZLE_GLOW_SIZE, '255,160,60', 0.9);
    const BOOSTER_AURA_SIZE = 190;
    const boosterAuraSprite = makeGlowSprite(BOOSTER_AURA_SIZE, '255,120,40', 0.55);

    // Slow pulse; the per-pickup phase (from its world y) keeps them out of sync
    function drawPickupGlow(name, cx, cy, phase, now) {
        const glow = PICKUP_GLOWS[name];
        if (!glow) return;
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 0.004 + phase);
        ctx.drawImage(glow, cx - PICKUP_GLOW_SIZE / 2, cy - PICKUP_GLOW_SIZE / 2, PICKUP_GLOW_SIZE, PICKUP_GLOW_SIZE);
        ctx.globalAlpha = 1;
    }

    // Whole-device-pixel positions avoid resampling the sprite, which is slower and blurrier
    function snap(v) {
        return Math.round(v * RENDER_SCALE) / RENDER_SCALE;
    }
    function drawSprite(name, cx, cy) {
        const sprite = SPRITES[name];
        if (sprite) ctx.drawImage(sprite, snap(cx - SPRITE_SIZE / 2), snap(cy - SPRITE_SIZE / 2), SPRITE_PIXELS / RENDER_SCALE, SPRITE_PIXELS / RENDER_SCALE);
    }

    function drawPowerUpIcon(pu, platform, platX, camY, now) {
        const cx = platX + platform.width / 2;
        const cy = platform.y - camY - 16; // center of icon area above platform (screen-space)
        drawPickupGlow(pu.type, cx, cy, platform.y * 0.05, now);
        drawSprite(pu.type, cx, cy);
    }

    // ─── Draw ─────────────────────────────────────────────────────────────────

    // Gradients are built once and reused: creating dozens per frame is slow on
    // some mobile browsers (notably Firefox for Android). Platform gradients span
    // y = 0..PLATFORM_HEIGHT, so platforms are drawn translated to their position.
    function makeVerticalGradient(height, stops) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        for (const [offset, color] of stops) grad.addColorStop(offset, color);
        return grad;
    }
    const bgGrad = makeVerticalGradient(CANVAS_HEIGHT, [[0, '#1a0a3c'], [1, '#2a4a7a']]);
    const movingPlatformGrad    = makeVerticalGradient(PLATFORM_HEIGHT, [[0, '#6aacee'], [0.4, '#3a7ecc'], [1, '#1a4e9a']]);
    const breakablePlatformGrad = makeVerticalGradient(PLATFORM_HEIGHT, [[0, '#c07048'], [1, '#7a3a18']]);
    const staticPlatformGrad    = makeVerticalGradient(PLATFORM_HEIGHT, [[0, '#5eca5e'], [0.3, '#3ca03c'], [1, '#1e6a1e']]);

    function fillPlatform(grad, x, y, w) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = grad;
        drawRoundRect(0, 0, w, PLATFORM_HEIGHT, 4);
        ctx.fill();
        ctx.restore();
    }

    // Umbrella held over the player's head: canopy with a scalloped rim on a pole
    // whose base (at the player's top center) is the pivot for a gentle sway.
    const UMBRELLA_RADIUS = 28;
    const UMBRELLA_POLE   = 30; // pole base to canopy rim
    function drawHeldUmbrella(baseX, baseY, sway) {
        const R = UMBRELLA_RADIUS;
        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate(sway);

        // Pole (its lower end is hidden behind the player's body)
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.lineTo(0, -UMBRELLA_POLE - R + 2);
        ctx.stroke();

        // Canopy: dome, then four scallops back along the rim
        ctx.translate(0, -UMBRELLA_POLE);
        ctx.beginPath();
        ctx.moveTo(-R, 0);
        ctx.arc(0, 0, R, Math.PI, 0, false);
        for (let i = 0; i < 4; i++) {
            ctx.arc(R - R / 4 - i * (R / 2), 0, R / 4, 0, Math.PI, true);
        }
        ctx.closePath();
        ctx.fillStyle = '#cc4488';
        ctx.fill();
        ctx.strokeStyle = '#7a2250';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Ribs from the tip to each scallop joint
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        for (const x of [-R / 2, 0, R / 2]) {
            ctx.moveTo(0, -R);
            ctx.quadraticCurveTo(x * 0.9, -R * 0.45, x, -R / 4);
        }
        ctx.stroke();
        ctx.restore();
    }

    // One booster rocket: nose cone, body with a racing stripe and porthole, a
    // tail fin on the outer side and a nozzle. x is its left edge.
    function drawBoosterPack(x, y, finSide) {
        const W  = BOOSTER_PACK_WIDTH;
        const H  = BOOSTER_PACK_HEIGHT;
        const cx = x + W / 2;

        // Fin
        const finX = finSide < 0 ? x : x + W;
        ctx.fillStyle = '#8a1f1f';
        ctx.beginPath();
        ctx.moveTo(finX, y + H - 16);
        ctx.lineTo(finX + finSide * 6, y + H - 4);
        ctx.lineTo(finX, y + H - 6);
        ctx.closePath();
        ctx.fill();

        // Nozzle
        ctx.fillStyle = '#555a66';
        ctx.beginPath();
        ctx.moveTo(x + 3, y + H - 5);
        ctx.lineTo(x + W - 3, y + H - 5);
        ctx.lineTo(x + W - 1, y + H);
        ctx.lineTo(x + 1, y + H);
        ctx.closePath();
        ctx.fill();

        // Body and nose cone
        ctx.fillStyle = '#d23a3a';
        ctx.beginPath();
        ctx.moveTo(x, y + H - 5);
        ctx.lineTo(x, y + 9);
        ctx.quadraticCurveTo(cx, y - 4, x + W, y + 9);
        ctx.lineTo(x + W, y + H - 5);
        ctx.closePath();
        ctx.fill();
        // Metallic highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + 2, y + 9, 2, H - 16);
        // Stripe
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(x, y + H - 13, W, 3);
        // Porthole
        ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.arc(cx, y + 11, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Layered flame cone (outer fire, yellow middle, blue-white core) with a
    // flickering glow at the nozzle. Drawn additively.
    const FLAME_LAYERS = [
        [6,   1,    'rgba(255,110,30,0.85)'],
        [4,   0.65, 'rgba(255,210,70,0.9)'],
        [2.2, 0.4,  'rgba(210,240,255,0.95)'],
    ];
    function drawBoosterFlame(cx, ny, len) {
        const glow = NOZZLE_GLOW_SIZE * (0.8 + 0.4 * Math.random());
        ctx.drawImage(nozzleGlowSprite, cx - glow / 2, ny + len * 0.3 - glow / 2, glow, glow);
        for (const [w, l, color] of FLAME_LAYERS) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(cx - w, ny);
            ctx.quadraticCurveTo(cx - w * 1.3, ny + len * l * 0.45, cx, ny + len * l);
            ctx.quadraticCurveTo(cx + w * 1.3, ny + len * l * 0.45, cx + w, ny);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Booster particles sit behind the player; the rest are drawn in front
    const BACK_PARTICLES = new Set(['smoke', 'flame', 'streak', 'ring']);

    function drawParticles(camY, alpha, back) {
        for (const part of particles) {
            if (BACK_PARTICLES.has(part.kind) !== back) continue;
            const pScreenY = interp(part.prevY, part.y, alpha) - camY;
            if (pScreenY < -60 || pScreenY > CANVAS_HEIGHT + 60) continue;
            const pX = interp(part.prevX, part.x, alpha);

            const t = part.life / part.maxLife; // 1 = fresh, 0 = dead

            if (part.kind === 'flame') {
                // Blue-white when fresh, then fire, shrinking as it cools
                const size = part.size * (0.4 + t);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = Math.min(1, t * 1.4);
                ctx.drawImage(t > 0.7 ? FLAME_HOT_SPRITE : FLAME_FIRE_SPRITE, pX - size / 2, pScreenY - size / 2, size, size);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
                continue;
            }
            if (part.kind === 'smoke') {
                // Grey puff that swells as it fades
                const shade = Math.floor(110 + 60 * t);
                ctx.fillStyle = `rgba(${shade},${shade},${shade + 10},${t * 0.35})`;
                ctx.beginPath();
                ctx.arc(pX, pScreenY, part.size * (1 + (1 - t) * 2.5), 0, Math.PI * 2);
                ctx.fill();
                continue;
            }
            if (part.kind === 'streak') {
                // Speed line
                ctx.fillStyle = `rgba(255,240,220,${t * 0.35})`;
                ctx.fillRect(pX, pScreenY, 1.5, part.size);
                continue;
            }
            if (part.kind === 'ring') {
                // Shockwave spreading flat from the launch point
                const radius = part.size * (1 - t) + 4;
                ctx.strokeStyle = `rgba(255,220,160,${t * 0.8})`;
                ctx.lineWidth   = 1 + 4 * t;
                ctx.beginPath();
                ctx.ellipse(pX, pScreenY, radius, radius * 0.35, 0, 0, Math.PI * 2);
                ctx.stroke();
                continue;
            }

            if (part.kind === 'exhaust') {
                // Orange → yellow → transparent
                const r = 255;
                const g = Math.floor(100 + 120 * t);
                const b = 0;
                ctx.fillStyle = `rgba(${r},${g},${b},${t * 0.8})`;
            } else if (part.kind === 'spark') {
                // Hot white-yellow ember
                ctx.fillStyle = `rgba(255,${Math.floor(180 + 75 * t)},${Math.floor(120 * t)},${t})`;
            } else {
                // Pickup sparkle: gold to white
                const r = 255;
                const g = Math.floor(200 + 55 * t);
                const b = Math.floor(100 * (1 - t));
                ctx.fillStyle = `rgba(${r},${g},${b},${t})`;
            }
            ctx.beginPath();
            ctx.arc(pX, pScreenY, part.size * t, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // alpha (0..1) is how far the renderer is between the previous physics step
    // and the current one; positions are blended so high-refresh screens show
    // in-between frames instead of repeating each 60Hz step.
    function draw(alpha, now = 0) {
        const camY = lerp(prevCameraY, cameraY, alpha);

        // ── Background gradient ──
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.save();
        if (shake > 0.2) ctx.translate(randRange(-shake, shake), randRange(-shake, shake));

        // ── Parallax soft circles (stars/clouds) ──
        for (const c of bgCircles) {
            const worldY  = c.yOffset + camY * c.speed;
            const screenY = ((worldY % (CANVAS_HEIGHT * 2)) + CANVAS_HEIGHT * 2) % (CANVAS_HEIGHT * 2);
            ctx.beginPath();
            ctx.arc(c.x, screenY - CANVAS_HEIGHT / 2, c.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${c.opacity})`;
            ctx.fill();
        }

        // ── Platforms ──
        for (const platform of platforms) {
            const screenY = platform.y - camY;
            const platX   = interp(platform.prevX, platform.x, alpha);

            if (platform.type === 'moving') {
                // Blue sheen
                fillPlatform(movingPlatformGrad, platX, screenY, platform.width);
                // Highlight
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(platX + 4, screenY + 1, platform.width - 8, 3);
            } else if (platform.type === 'breakable') {
                // Brown cracked look
                fillPlatform(breakablePlatformGrad, platX, screenY, platform.width);
                // Crack line
                ctx.strokeStyle = '#3a1a08';
                ctx.lineWidth   = 1.5;
                ctx.beginPath();
                ctx.moveTo(platX + platform.width * 0.35, screenY + 1);
                ctx.lineTo(platX + platform.width * 0.45, screenY + 6);
                ctx.lineTo(platX + platform.width * 0.55, screenY + 3);
                ctx.stroke();
            } else {
                // Static: green with grass-lip
                fillPlatform(staticPlatformGrad, platX, screenY, platform.width);
                // Grass lip highlight
                ctx.fillStyle = 'rgba(180,255,120,0.45)';
                ctx.fillRect(platX + 3, screenY + 1, platform.width - 6, 3);
            }

            // Power-up icon
            if (platform.powerUp && !platform.powerUp.collected) {
                drawPowerUpIcon(platform.powerUp, platform, platX, camY, now);
            }

            // Gold icon (a platform never has both gold and a power-up)
            if (platform.coin && !platform.coin.collected) {
                const coinCx = platX + platform.width / 2;
                const coinCy = platform.y - camY - COIN_OFFSET_Y;
                drawPickupGlow(platform.coin.type, coinCx, coinCy, platform.y * 0.05, now);
                drawSprite(platform.coin.type, coinCx, coinCy);
            }
        }

        // ── Player ──
        // Screen wrap teleports the player, so don't blend across it
        const px = Math.abs(player.x - player.prevX) > CANVAS_WIDTH / 2 ? player.x : interp(player.prevX, player.x, alpha);
        const playerScreenY = interp(player.prevY, player.y, alpha) - camY;

        // Squash/stretch based on velocity
        const stretchFactor = playerStretch(interp(player.prevVelocityY, player.velocityY, alpha));
        const drawH = PLAYER_HEIGHT * stretchFactor;
        const drawY = playerScreenY + PLAYER_HEIGHT - drawH; // anchor bottom

        drawParticles(camY, alpha, true);

        // Booster: flickering heat aura behind the player
        const booster = activeEffects.booster;
        const spool   = booster ? 1 - booster.ignition / BOOSTER_IGNITION_FRAMES : 0;
        if (booster) {
            const size = BOOSTER_AURA_SIZE * (0.5 + 0.5 * spool) * (0.9 + 0.2 * Math.random());
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5 + 0.5 * spool;
            ctx.drawImage(boosterAuraSprite, px + PLAYER_WIDTH / 2 - size / 2, drawY + drawH * 0.7 - size / 2, size, size);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        // Star: pulsing golden aura behind the player
        const starPulse = 0.5 + 0.5 * Math.sin(now * 0.008);
        if (activeEffects.star) {
            const size = (0.8 + 0.15 * starPulse) * GLOW_SIZE;
            ctx.globalAlpha = 0.65 + 0.35 * starPulse;
            ctx.drawImage(glowSprite, px + PLAYER_WIDTH / 2 - size / 2, drawY + drawH / 2 - size / 2, size, size);
            ctx.globalAlpha = 1;
        }

        // Umbrella: held overhead, drawn before the body so the pole tucks behind it
        if (activeEffects.umbrella) {
            drawHeldUmbrella(px + PLAYER_WIDTH / 2, drawY, 0.08 * Math.sin(now * 0.004));
        }

        // Body gradient
        const bodyGrad = ctx.createLinearGradient(px, drawY, px + PLAYER_WIDTH, drawY + drawH);
        bodyGrad.addColorStop(0, '#66aaff');
        bodyGrad.addColorStop(1, '#2255bb');
        ctx.fillStyle = bodyGrad;
        drawRoundRect(px, drawY, PLAYER_WIDTH, drawH, 6);
        ctx.fill();
        if (activeEffects.star) {
            // Gold outline, pulsing with the aura
            ctx.strokeStyle = `rgba(255,215,60,${0.6 + 0.4 * starPulse})`;
            ctx.lineWidth   = 2.5;
            ctx.stroke();
        }

        // Jetpack pack on player back (left side)
        if (activeEffects.jetpack) {
            ctx.fillStyle = '#cc4444';
            ctx.beginPath();
            ctx.roundRect(px - 10, drawY + 4, 10, 22, 3);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(px - 9, drawY + 26);
            ctx.lineTo(px - 2, drawY + 26);
            ctx.lineTo(px - 5, drawY + 34);
            ctx.closePath();
            ctx.fill();
        }

        // Booster: a rocket strapped to each side, flames roaring from both
        if (booster) {
            const packY  = boosterPackTop(drawY, drawH);
            const leftX  = px - BOOSTER_PACK_WIDTH;
            const rightX = px + PLAYER_WIDTH;
            ctx.globalCompositeOperation = 'lighter';
            for (const x of [leftX, rightX]) {
                const len = booster.ignition > 0 ? 6 + 22 * spool * (0.7 + 0.3 * Math.random()) : 36 + 18 * Math.random();
                drawBoosterFlame(x + BOOSTER_PACK_WIDTH / 2, packY + BOOSTER_PACK_HEIGHT, len);
            }
            ctx.globalCompositeOperation = 'source-over';
            drawBoosterPack(leftX,  packY, -1);
            drawBoosterPack(rightX, packY,  1);
        }

        // Spring boots on feet
        if (activeEffects.boots) {
            ctx.fillStyle = '#8844cc';
            ctx.fillRect(px + 2, drawY + drawH, 14, 5);
            ctx.fillRect(px + PLAYER_WIDTH - 16, drawY + drawH, 14, 5);
        }

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + 8,  drawY + 10, 9, 9);
        ctx.fillRect(px + 23, drawY + 10, 9, 9);
        // Pupils (4px) can shift 2.5px either way from the center of each 9px eye
        const pupilX = gaze.x * 2.5;
        const pupilY = gaze.y * 2.5;
        ctx.fillStyle = '#111';
        ctx.fillRect(px + 10.5 + pupilX, drawY + 12.5 + pupilY, 4, 4);
        ctx.fillRect(px + 25.5 + pupilX, drawY + 12.5 + pupilY, 4, 4);

        // Mouth (small curved line approximated by rect)
        ctx.fillStyle = '#334';
        ctx.fillRect(px + 13, drawY + 24, 14, 2);

        // Feet/limbs (simple stubs)
        ctx.fillStyle = '#2255bb';
        ctx.fillRect(px + 4,              drawY + drawH - 2, 10, 6);
        ctx.fillRect(px + PLAYER_WIDTH - 14, drawY + drawH - 2, 10, 6);

        // ── Particles ──
        drawParticles(camY, alpha, false);
        ctx.restore(); // screen shake

        // Launch / cut-off flash
        if (flash > 0.02) {
            ctx.fillStyle = `rgba(255,245,225,${flash})`;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    }

    // ─── Interpolation ────────────────────────────────────────────────────────
    // Positions as of the previous physics step. Objects created during a step
    // have no previous position yet, so interp() falls back to the current one.
    let prevCameraY = 0;

    function interp(prev, curr, alpha) {
        return prev === undefined ? curr : lerp(prev, curr, alpha);
    }

    function savePreviousPositions() {
        prevCameraY          = cameraY;
        player.prevX         = player.x;
        player.prevY         = player.y;
        player.prevVelocityY = player.velocityY;
        for (const p of platforms) p.prevX = p.x;
        for (const part of particles) {
            part.prevX = part.x;
            part.prevY = part.y;
        }
    }

    // ─── Game Loop ────────────────────────────────────────────────────────────
    // Fixed 60Hz timestep: update() is tuned per-frame, so run it at a constant
    // rate regardless of display refresh rate (120/144Hz screens ran too fast).
    const STEP_MS = 1000 / 60;
    const MAX_STEPS_PER_FRAME = 5; // avoid spiral of death after tab switches
    // Frame timestamps jitter (Firefox rounds them to ~1ms), so a 60Hz frame can
    // measure 16.2ms or 17.1ms. Without slack the loop alternates 0/1/2 steps per
    // frame, which reads as stutter. Accepting a step up to 1/8 early keeps 60Hz at
    // exactly one step per frame; the accumulator can go slightly negative, so the
    // long-run speed is unchanged.
    const STEP_TOLERANCE_MS = STEP_MS / 8;
    let lastTime = null;
    let accumulator = 0;

    function loop(now) {
        if (lastTime === null) lastTime = now;
        accumulator += now - lastTime;
        lastTime = now;

        let steps = 0;
        while (accumulator >= STEP_MS - STEP_TOLERANCE_MS && steps < MAX_STEPS_PER_FRAME) {
            // Always snapshot, so once the game stops, previous == current and nothing drifts
            savePreviousPositions();
            if (gameState === 'running') update();
            accumulator -= STEP_MS;
            steps++;
        }
        if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
        if (steps > 0) emitIfChanged();

        // The accumulator can dip slightly negative (see STEP_TOLERANCE_MS)
        draw(Math.min(Math.max(accumulator / STEP_MS, 0), 1), now);
        rafId = requestAnimationFrame(loop);
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    // startLoop: begin the RAF draw loop WITHOUT changing gameState.
    // Used on mount so the idle screen renders immediately.
    function startLoop() {
        if (rafId === null) {
            rafId = requestAnimationFrame(loop);
        }
    }

    // start: begin the RAF loop AND switch gameState to 'running'.
    // Called by App's handleStart() (after reset()) as the sole way to begin a run.
    function start() {
        startLoop();
        gameState = 'running';
        if (hasBoosterLiftOff()) igniteBooster();
        emit();
    }

    function stop() {
        stopAllLoops();
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            lastTime = null;
            accumulator = 0;
        }
    }

    function toMenu() {
        gameState = 'idle';
        reset(); // reset sets state, emits idle snapshot internally
    }

    function subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
    }

    function getSnapshot() {
        return {
            gameState,
            score,
            highScore,
            coins,
            activeEffects: effectsSnapshot(),
            justUnlocked,
            gold,
            justSaved,
        };
    }

    // Seed initial state so getSnapshot() is valid before first frame (amendment #2)
    score               = 0;
    scoreBonus          = 0;
    coins               = 0;
    activeEffects       = {};
    particles           = [];
    cameraY             = 0;
    justSaved           = false;
    moveSpeedMultiplier       = getMoveSpeedMultiplier();
    jetpackDurationMultiplier = getJetpackFuelMultiplier();
    starGoldMultiplier        = getStarGoldMultiplier();
    umbrellaFallReduction     = getUmbrellaFallReduction();
    bounceVelocity            = BOUNCE_VELOCITY * getHigherJumpMultiplier();
    bootsBounceVelocity       = BOOTS_BOUNCE_VELOCITY * getHigherJumpMultiplier();
    breakableExtraLandings    = getBreakableGripLevel();
    backupJetpackArmed        = hasBackupJetpack();

    // Pre-init platforms/player so draw() has valid data even before reset()
    const _initW     = platformWidth(0);
    const _starterY  = CANVAS_HEIGHT - 40;
    platforms = [{ x: Math.floor((CANVAS_WIDTH - _initW) / 2), y: _starterY, width: _initW, type: 'static' }];
    player    = { x: Math.floor((CANVAS_WIDTH - PLAYER_WIDTH) / 2), y: _starterY - PLAYER_HEIGHT, velocityY: 0 };

    return { start, startLoop, stop, reset, toMenu, setInput, setDragTargetFromClient, clearDragTarget, subscribe, getSnapshot };
}
