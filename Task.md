# 1. Game Improvements & Polish

## Task 1 — Clean Up Experimental Mode

* Exclude all features from Experimental Mode (make them permenenant), except for the farting sound when falling.
* **New gameplay features**, such as emotes and other experimental gameplay mechanics, should be placed behind the Experimental Mode toggle.
* This requirement applies only to new gameplay features and does not apply to bug fixes, performance improvements, screen/display changes, or platform compatibility updates.

## Task 2 — Fix Multiple Achievement Notifications

* Fix the issue where, if two achievements are unlocked at the same time, only one achievement notification is shown.
* Chain achievement events so that when multiple achievements are unlocked, their notifications are displayed one after another rather than at the same time.

## Task 3: Give Blunday Feelings (Emotes & Reactions)

* Blunday is a small blue cube with big dreams, and right now they have the emotional range of a brick. Give them some personality with occasional emotes and reactions.
* Trigger emotes from certain actions or events, but not every time the action happens. They should feel spontaneous and a bit random, like a cube that has moods.
* New emotes should only be available when Experimental Mode is enabled.
* Possible reactions:

  * **Smile:** A casual "life is good, gravity is a scam" face at random calm moments.
  * **Tongue out:** A cheeky, playful face, e.g. after a close call or just because.
  * **Shocked gem face:** Jaw drops when collecting something valuable, like a red gem (angry coin), green gem or purple gem. Purple gems deserve the most dramatic reaction.
  * **Money eyes:** An excited reaction after grabbing a big pile of riches in a short time (coins, gold bars, gold bags). *Get Rich or Fall Trying*, in emote form.
  * **Relieved/proud face:** After a successful landing on a difficult jump, e.g. a long stretch or a last-moment save.
  * **"Thrust Issues" face:** Surprised or wide-eyed when a jetpack kicks in.
  * **Sproing face:** Excited when bouncing with spring boots (*Springy Spaghetti Legs* energy).
  * **Dizzy/confused face:** Rolling or swirling eyes when landing on a purple invert platform and the controls flip. Left is right now, and Blunday is just as confused as the player.
  * **"Wood you please stop?" face:** A mildly annoyed or startled look now and then when a wooden platform breaks underfoot.
  * **Mary Poppins face:** Calm and floaty, maybe a little smug, while drifting with the umbrella (the umbrella is still not rated for this altitude).
  * **Panic → relief:** Wide-eyed panic while falling, then relief when the Ctrl+Z Jetpack saves them from certain doom.
  * **"Houston, we have a Blunday":** A determined or triumphant face during Booster Ignition & Lift Off.
  * **Celebration:** After a particularly good jump or chain of actions, e.g. a long combo of clean landings.
  * **Sleepy/bored face:** When standing still for a while. Yawning, half-closed eyes, maybe a "Zzz". Blunday did not come here to nap, but it's a Monday.
* Consider small visual effects with some reactions: stars, sparkles, hearts, little coin symbols for money eyes, swirls for dizzy, "Zzz" for sleepy, sweat drops for panic.
* Keep reactions occasional so they stay fun and don't get repetitive or distracting. A cube with too many feelings is just exhausting.
* Consider slightly randomized reactions (different variants, timing or intensity) so Blunday feels more alive and playful.
* Reactions must never hide hazards, platforms or pickups, or get in the way of gameplay.

## Task 4: Emotes on the Title Screen

* Every now and then, show emotes in the background of the title screen, e.g. Blunday peeking in, blinking, smiling, yawning or looking suspiciously at the Play button.
* Keep it rare enough that the title screen doesn't get distracting or repetitive. It's a cameo, not a stand-up routine.
* These emotes must also respect the Experimental Mode toggle.

## Task 5: Blunday's Wardrobe (Character Customization)

* Blunday has been wearing the same blue for their entire life. Let players customize them with different colors and funny accessories, because reaching the Moon is a lot easier when you look good doing it.
* Customization is cosmetic only and has no effect on gameplay. It is **not** behind the Experimental Mode toggle.

### Unlocking

* Every color and accessory is locked behind an achievement: **1 achievement = 1 unlock** (a color or an accessory).
* There will be more colors and accessories than achievements, and that's on purpose. The extras stay locked for now (a shop or other unlock method may come later), so build the unlock system so new unlock sources can be added easily.
* Blunday Blue is the default and is always unlocked. Every accessory slot also has a **None** option, which is always unlocked.
* Players who already have achievements should get the matching unlocks right away.
* When an achievement unlocks something, the achievement notification should mention the reward, e.g. "Unlocked: Propeller Cap".
* Locked items are shown slightly grayed out with a lock icon. Tapping one tells the player how to unlock it, e.g. "Unlock with *Thrust Issues*". Items with no unlock source yet say something like "Coming soon. Rumor has it there's a shop."
* Save the selected look and the unlocks locally, along with the rest of the player's progress.

### Colors (16)

Each color should replace Blunday's body color, including the shading and highlights, so it never looks like a flat sticker. Suggested colors:

1. **Blunday Blue:** the classic. Default, always unlocked.
2. **Angry Coin Red:** like a red gem, but on purpose.
3. **Gold Digger Gold:** shiny, rich, slightly smug.
4. **Monday Grey:** the color of a Monday morning.
5. **Touch Grass Green:** for players who have actually seen grass.
6. **Left Is Right Purple:** in honor of the invert platform.
7. **Termite Snack Brown:** the wooden platforms' revenge.
8. **Afterburner Orange:** fresh out of the jetpack.
9. **Bubblegum Pink:** sweet, but still falls.
10. **Moon Dust White:** dressed for the destination.
11. **Deep Space Navy:** for cubes that like to stay incognito.
12. **Mint Condition:** never been dropped (it has).
13. **Banana for Scale Yellow:** bright enough to see from orbit.
14. **Toe Bean Peach:** toe beans included.
15. **Cyan-tifically Accurate:** tested in a lab (it wasn't).
16. **Fell Too Far Black:** what's left after a really long fall.

### Accessories

There are four accessory slots, with one item per slot: **Hat**, **Hair**, **Glasses** and **Face**. Suggested items:

* **Hats**
  * **Propeller Cap:** the budget jetpack. It doesn't work. Probably.
  * **Backwards Cap:** No Cap. Bag secured.
  * **Top Hat:** for when you've made six figures and want everyone to know it.
  * **Hard Hat:** wooden platform safety equipment. OSHA approved (it isn't).
  * **Crown:** maxed out and loving it.
  * **Party Hat:** it's always someone's birthday somewhere.
  * **Pom-Pom Beanie:** it's cold up near the Moon.
  * **Tiny Umbrella Hat:** finally rated for this altitude.
  * **Viking Helmet:** Valhalla is just a bit higher.
* **Hair**
  * **Mullet:** business in the front, gravity in the back.
  * **Mohawk:** aerodynamic, allegedly.
  * **Spiky Anime Hair:** power level over 10,000.
  * **Fancy Combover:** hides nothing, fools no one.
  * **Big Fluffy Hair:** extra air resistance.
  * **Bowl Cut:** a classic.
  * **One Single Hair:** Monday hair. Barely there, never quits.
* **Glasses**
  * **Deal With It Shades:** pixel sunglasses, best worn while falling.
  * **Star Shades:** what is this shiny thing?
  * **Monocle:** I Can Fall Now (with dignity).
  * **Taped Nerd Glasses:** they've seen some falls.
  * **Heart Glasses:** for cubes in love with gold.
  * **3D Glasses:** the platforms really pop.
  * **Ski Goggles:** for the trip down. Mostly the trip down.
* **Face**
  * **Handlebar Mustache:** distinguished, thriving, Thirty-K.
  * **Pencil Mustache:** suave, mysterious, slightly suspicious.
  * **Walrus Mustache:** old money.
  * **Goatee:** evil-twin mode.
  * **Bubble Gum Bubble:** pops when landing, sometimes.
  * **Rosy Cheeks:** permanently flustered by the view.

### Suggested Achievement Rewards (17)

| Achievement | Unlock |
| --- | --- |
| Thrust Issues | Propeller Cap |
| What are thoooose! | Spiky Anime Hair |
| What is this shiny thing? | Star Shades |
| Bag Secured, No Cap | Backwards Cap |
| Raising the Bar | Gold Digger Gold |
| Gem of My Eye | Angry Coin Red |
| Ten Thousand Reasons to Brag | Deal With It Shades |
| Thirty-K and Thriving | Handlebar Mustache |
| Six Figures, Baby | Top Hat |
| Wood You Please Stop? | Hard Hat |
| A Star is Born | Mullet |
| Got Any Spare Change? | Monday Grey |
| Look Ma, No Power-Ups! | Touch Grass Green |
| Maxed Out and Loving It | Crown |
| Emergency Exit Rocket | Afterburner Orange |
| Houston, We Have a Blunday | Moon Dust White |
| I Can Fall Now | Monocle |

Everything else stays locked as "coming soon".

### Combining Items

* Any combination should look good: every color with every accessory, and any accessory with any other (e.g. glasses + mustache, cap + hair, top hat + mullet + monocle + walrus mustache).
* Draw the layers in a fixed order, from back to front: body → face → glasses → hair → hat.
* Hair worn with a hat should still look right. Hair should peek out from under the hat (sides, back, fringe) instead of clipping through it, and tall hairstyles such as the mohawk or big fluffy hair should squash or tuck neatly under the hat.
* Glasses and face items must not overlap awkwardly. Mustaches sit below the glasses and above the mouth area.
* Accessories must still work with the emotes from Task 3. Eyes and mouth reactions should stay readable, e.g. eyes visible through clear glasses. With dark shades, the emote can show through the mouth, the effects or the shades slipping down for a moment.
* Accessories should follow Blunday's movement (bounce, squash and stretch, jetpack, umbrella, boosters) so nothing floats off on its own. Unless it's funny, like the Propeller Cap spinning on the jetpack.
* Accessories should stay small enough not to hide platforms, pickups or hazards, and shouldn't make the character look bigger than their real hitbox.

### Character Button & Screen

* Add a **Character** button in the **bottom-left** corner, opposite the Settings button (bottom-right).
* The button should look like Blunday (a small cube face, similar to the in-game character) and match the style and size of the Settings button. Ideally it shows the currently equipped color and accessories.
* The button is visible on both the **title screen** and the **game over screen**, like the Settings button.
* The button opens a Character screen with:
  * A large live preview of Blunday with the current look, maybe doing a small idle animation.
  * Tabs or sections for Colors, Hats, Hair, Glasses and Face.
  * A grid of items per section, with locked items grayed out and showing a lock icon. Equipped items are clearly highlighted.
  * An unlock progress counter, e.g. "12 / 45 unlocked".
  * Optional: a **Randomize** button that picks a random look from unlocked items, for players who can't decide what to wear to the Moon.
* Use the same layout, back button and visual style as the other screens (Settings, Upgrades, Achievements), and make sure it works on small phones and large screens.
* The selected look is used everywhere Blunday appears: in game, on the title screen and in the emote cameos.


# 2. Recommendations from Play Console

## Task 6 — Fix Edge-to-Edge Display

* Ensure the game correctly supports edge-to-edge display on Android 15 and newer.
* Handle window insets correctly so that UI elements are not hidden behind system bars.
* Test the game on different screen sizes and Android versions.
* Consider using `enableEdgeToEdge()` for Kotlin or `EdgeToEdge.enable()` for Java for backward compatibility.

## Task 7 — Remove Deprecated Edge-to-Edge APIs

* Identify and remove any deprecated APIs or parameters related to edge-to-edge display and window configuration.
* Replace them with the currently supported Android APIs.

## Task 8 — Improve Large-Screen Support

* Remove unnecessary screen resizing and orientation restrictions.
* Ensure the game supports different screen configurations and large-screen devices.
* Test the game on different aspect ratios and screen sizes to ensure there are no layout issues.

## Task 9 — Investigate Intermittent Screen Slowdown

* Investigate reports from some users experiencing occasional screen slowdown.
* The issue does not appear to be a typical lag spike. Instead, the game can appear to run at a significantly lower refresh rate or frame rate, making the entire screen look slow.
* The issue only occurs on some devices and only occasionally.
* Verify that the slowdown is not caused by battery saver or similar power-saving features.
* Investigate whether this could be related to the Android 15 edge-to-edge/display changes recommended by Google Play Console.
* Check for possible rendering, frame-rate, screen refresh-rate, GPU, or device-specific issues.
* Test on different devices, refresh rates, Android versions, and screen configurations.
* Profile the game during the slowdown to identify potential frame-time spikes, rendering bottlenecks, or unintended frame-rate limitations.
