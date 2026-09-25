import { unlock } from './achievements.js';
import { getGold, addGold, getTotalEarned } from './wallet.js';
import { getMoveSpeedMultiplier, getPowerUpFreqMultiplier, getJetpackFuelMultiplier, getHigherJumpMultiplier, getBreakableGripLevel, hasBackupJetpack, getLuckCoinBonus, getStarGoldMultiplier, getUmbrellaFallReduction, areAllUpgradesMaxed } from './upgrades.js';
import { playSfx, pickVariant, setLoop, stopAllLoops } from './audio.js';
import { isExperimental } from './settings.js';
import { drawJetpackGlyph, drawBootsGlyph, drawStarGlyph, drawCoinGlyph, drawCoinBagGlyph, drawGoldBarGlyph, drawRedGemGlyph, drawUmbrellaGlyph } from './glyphs.js';

// ─── Coordinate Convention ───────────────────────────────────────────────────
// World-y increases DOWNWARD (standard canvas default).
// Ascending means decreasing y. cameraY starts at 0 and only ever
// decreases (moves up, never back down).
// screenY = worldY - cameraY
// score   = max(score, floor(-cameraY))
// Cull a platform when platform.y > cameraY + CANVAS_HEIGHT.
// Game over when player.y - cameraY > CANVAS_HEIGHT.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_WIDTH    = 400;
const CANVAS_HEIGHT   = 600;
const GRAVITY         = 0.4;
const BOUNCE_VELOCITY = -12;
const PLAYER_WIDTH    = 40;
const PLAYER_HEIGHT   = 40;
const MOVE_SPEED      = 5;
const PLATFORM_HEIGHT = 12;
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

// Power-ups whose sound loops for as long as the effect is active
const LOOPED_EFFECT_SOUNDS = ['jetpack', 'umbrella'];

// Parallax background circles
const BG_CIRCLE_COUNT = 18;

export function createGame(canvas) {
    const ctx = canvas.getContext('2d');

    // ─── Mutable state ────────────────────────────────────────────────────────
    let gameState = 'idle';
    let player;
    let platforms;
    let cameraY;
    let score;
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
        const V30  = [0.30, 0.30, 0.25, 0.15];
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
    const EXCLUSIVE_RANK = { umbrella: 1, boots: 2, jetpack: 3 };

    function activeExclusiveEffect() {
        for (const t in EXCLUSIVE_RANK) if (activeEffects[t]) return t;
        return null;
    }

    function clearExclusiveEffects() {
        for (const t in EXCLUSIVE_RANK) delete activeEffects[t];
    }

    // Looped sounds are driven by the effect tick. One-shots pick a random
    // variant per activation, and re-picking an active power-up reuses it.
    function playPowerUpSound(type, alreadyActive) {
        if (LOOPED_EFFECT_SOUNDS.includes(type)) return;
        if (!alreadyActive || effectSoundVariant[type] === undefined) effectSoundVariant[type] = pickVariant(type);
        playSfx(type, effectSoundVariant[type]);
    }

    function effectsSnapshot() {
        const order = ['jetpack', 'boots', 'umbrella', 'star'];
        return order
            .filter(t => activeEffects[t])
            .map(t => ({ type: t, remaining: activeEffects[t].remaining, total: activeEffects[t].total }));
    }

    // ─── Difficulty ───────────────────────────────────────────────────────────
    function getDifficulty(s) {
        if (s >= 5000) {
            return { gapMin: 105, gapMax: 120, width: 50,  movingChance: 0.45, breakChance: 0.25,
                     powerUpChance: 0.097, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 3, starWeight: 5, umbrellaWeight: 3 };
        } else if (s >= 3000) {
            return { gapMin: 100, gapMax: 115, width: 55,  movingChance: 0.35, breakChance: 0.15,
                     powerUpChance: 0.072, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else if (s >= 1500) {
            return { gapMin: 90,  gapMax: 110, width: 60,  movingChance: 0.20, breakChance: 0.00,
                     powerUpChance: 0.05, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else if (s >= 500) {
            return { gapMin: 80,  gapMax: 100, width: 70,  movingChance: 0.00, breakChance: 0.00,
                     powerUpChance: 0.04, // pre-divided by P(static)=(1-movingChance)*(1-breakChance) to yield ~4% effective per-platform spawn rate
                     jetpackWeight: 2, bootsWeight: 4, starWeight: 4, umbrellaWeight: 3 };
        } else {
            return { gapMin: 70,  gapMax: 90,  width: 80,  movingChance: 0.00, breakChance: 0.00,
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

    // ─── Spawn ────────────────────────────────────────────────────────────────
    function spawnPlatformAbove(topmostY) {
        const diff  = getDifficulty(score);
        const newY  = topmostY - randInt(diff.gapMin, diff.gapMax);
        const width = diff.width;
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
        score           = 0;
        coins           = 0;
        activeEffects   = {};
        particles       = [];
        justUnlocked    = [];
        stopAllLoops();
        gold            = getGold(); // upgrades bought in the menu may have spent gold
        dragTargetX     = null;
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

        const starterDiff  = getDifficulty(0);
        const starterWidth = starterDiff.width;
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
                playSfx(platform.broken ? 'wood' : 'jump');

                return platform;
            }
        }
        return null;
    }

    // ─── Update ───────────────────────────────────────────────────────────────
    function update() {
        moveHorizontal();

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
                    score += STAR_SCORE_BONUS;
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
            const coinY = p.y - 46;
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

        // Jetpack overrides gravity
        if (activeEffects.jetpack) {
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

        score     = Math.max(score,     Math.floor(-cameraY));
        highScore = Math.max(highScore, score);

        if (score >= 10000 && !scoreAchAwarded) { scoreAchAwarded = true; tryUnlock('score_10000'); }
        if (score >= 30000 && !score30kAchAwarded) { score30kAchAwarded = true; tryUnlock('score_30000'); }
        if (score >= 100000 && !score100kAchAwarded) { score100kAchAwarded = true; tryUnlock('score_100000'); }

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
            activeEffects[key].remaining--;
            if (activeEffects[key].remaining <= 0) delete activeEffects[key];
        }
        for (const type of LOOPED_EFFECT_SOUNDS) setLoop(type, !!activeEffects[type]);

        // Update particles
        particles = particles.filter(part => {
            part.x    += part.vx;
            part.y    += part.vy;
            part.vy   += 0.1; // light gravity on particles
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
    const SPRITE_SIZE = 48; // glyphs extend at most ~16px from their center
    function makeSprite(drawGlyph) {
        const sprite = document.createElement('canvas');
        sprite.width  = SPRITE_SIZE;
        sprite.height = SPRITE_SIZE;
        drawGlyph(sprite.getContext('2d'), SPRITE_SIZE / 2, SPRITE_SIZE / 2);
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

    // Whole-pixel positions avoid resampling the sprite, which is slower and blurrier
    function drawSprite(name, cx, cy) {
        const sprite = SPRITES[name];
        if (sprite) ctx.drawImage(sprite, Math.round(cx - SPRITE_SIZE / 2), Math.round(cy - SPRITE_SIZE / 2));
    }

    function drawPowerUpIcon(pu, platform) {
        const cx = platform.x + platform.width / 2;
        const cy = platform.y - cameraY - 16; // center of icon area above platform (screen-space)
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

    function draw() {
        // ── Background gradient ──
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // ── Parallax soft circles (stars/clouds) ──
        for (const c of bgCircles) {
            const worldY  = c.yOffset + cameraY * c.speed;
            const screenY = ((worldY % (CANVAS_HEIGHT * 2)) + CANVAS_HEIGHT * 2) % (CANVAS_HEIGHT * 2);
            ctx.beginPath();
            ctx.arc(c.x, screenY - CANVAS_HEIGHT / 2, c.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${c.opacity})`;
            ctx.fill();
        }

        // ── Platforms ──
        for (const platform of platforms) {
            const screenY = platform.y - cameraY;

            if (platform.type === 'moving') {
                // Blue sheen
                fillPlatform(movingPlatformGrad, platform.x, screenY, platform.width);
                // Highlight
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(platform.x + 4, screenY + 1, platform.width - 8, 3);
            } else if (platform.type === 'breakable') {
                // Brown cracked look
                fillPlatform(breakablePlatformGrad, platform.x, screenY, platform.width);
                // Crack line
                ctx.strokeStyle = '#3a1a08';
                ctx.lineWidth   = 1.5;
                ctx.beginPath();
                ctx.moveTo(platform.x + platform.width * 0.35, screenY + 1);
                ctx.lineTo(platform.x + platform.width * 0.45, screenY + 6);
                ctx.lineTo(platform.x + platform.width * 0.55, screenY + 3);
                ctx.stroke();
            } else {
                // Static: green with grass-lip
                fillPlatform(staticPlatformGrad, platform.x, screenY, platform.width);
                // Grass lip highlight
                ctx.fillStyle = 'rgba(180,255,120,0.45)';
                ctx.fillRect(platform.x + 3, screenY + 1, platform.width - 6, 3);
            }

            // Power-up icon
            if (platform.powerUp && !platform.powerUp.collected) {
                drawPowerUpIcon(platform.powerUp, platform);
            }

            // Coin icon (offset above power-up slot so they don't stack)
            if (platform.coin && !platform.coin.collected) {
                const coinCx = platform.x + platform.width / 2;
                const coinCy = platform.y - cameraY - 36;
                drawSprite(platform.coin.type, coinCx, coinCy);
            }
        }

        // ── Player ──
        const playerScreenY = player.y - cameraY;

        // Squash/stretch based on velocity
        const stretchFactor = Math.max(0.7, Math.min(1.3, 1 + player.velocityY * 0.02));
        const drawH = PLAYER_HEIGHT * stretchFactor;
        const drawY = playerScreenY + PLAYER_HEIGHT - drawH; // anchor bottom

        // Body gradient
        const bodyGrad = ctx.createLinearGradient(player.x, drawY, player.x + PLAYER_WIDTH, drawY + drawH);
        bodyGrad.addColorStop(0, '#66aaff');
        bodyGrad.addColorStop(1, '#2255bb');
        ctx.fillStyle = bodyGrad;
        drawRoundRect(player.x, drawY, PLAYER_WIDTH, drawH, 6);
        ctx.fill();

        // Jetpack pack on player back (left side)
        if (activeEffects.jetpack) {
            ctx.fillStyle = '#cc4444';
            ctx.beginPath();
            ctx.roundRect(player.x - 10, drawY + 4, 10, 22, 3);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(player.x - 9, drawY + 26);
            ctx.lineTo(player.x - 2, drawY + 26);
            ctx.lineTo(player.x - 5, drawY + 34);
            ctx.closePath();
            ctx.fill();
        }

        // Spring boots on feet
        if (activeEffects.boots) {
            ctx.fillStyle = '#8844cc';
            ctx.fillRect(player.x + 2, drawY + drawH, 14, 5);
            ctx.fillRect(player.x + PLAYER_WIDTH - 16, drawY + drawH, 14, 5);
        }

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(player.x + 8,  drawY + 10, 9, 9);
        ctx.fillRect(player.x + 23, drawY + 10, 9, 9);
        ctx.fillStyle = '#111';
        ctx.fillRect(player.x + 10, drawY + 12, 4, 4);
        ctx.fillRect(player.x + 25, drawY + 12, 4, 4);

        // Mouth (small curved line approximated by rect)
        ctx.fillStyle = '#334';
        ctx.fillRect(player.x + 13, drawY + 24, 14, 2);

        // Feet/limbs (simple stubs)
        ctx.fillStyle = '#2255bb';
        ctx.fillRect(player.x + 4,              drawY + drawH - 2, 10, 6);
        ctx.fillRect(player.x + PLAYER_WIDTH - 14, drawY + drawH - 2, 10, 6);

        // ── Particles ──
        for (const part of particles) {
            const pScreenY = part.y - cameraY;
            if (pScreenY < -20 || pScreenY > CANVAS_HEIGHT + 20) continue;

            const t = part.life / part.maxLife; // 1 = fresh, 0 = dead

            if (part.kind === 'exhaust') {
                // Orange → yellow → transparent
                const r = 255;
                const g = Math.floor(100 + 120 * t);
                const b = 0;
                ctx.fillStyle = `rgba(${r},${g},${b},${t * 0.8})`;
            } else {
                // Pickup sparkle: gold to white
                const r = 255;
                const g = Math.floor(200 + 55 * t);
                const b = Math.floor(100 * (1 - t));
                ctx.fillStyle = `rgba(${r},${g},${b},${t})`;
            }
            ctx.beginPath();
            ctx.arc(part.x, pScreenY, part.size * t, 0, Math.PI * 2);
            ctx.fill();
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
            if (gameState === 'running') update();
            accumulator -= STEP_MS;
            steps++;
        }
        if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
        if (steps > 0) emitIfChanged();

        draw();
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
    const _initDiff  = getDifficulty(0);
    const _initW     = _initDiff.width;
    const _starterY  = CANVAS_HEIGHT - 40;
    platforms = [{ x: Math.floor((CANVAS_WIDTH - _initW) / 2), y: _starterY, width: _initW, type: 'static' }];
    player    = { x: Math.floor((CANVAS_WIDTH - PLAYER_WIDTH) / 2), y: _starterY - PLAYER_HEIGHT, velocityY: 0 };

    return { start, startLoop, stop, reset, toMenu, setInput, setDragTargetFromClient, clearDragTarget, subscribe, getSnapshot };
}
