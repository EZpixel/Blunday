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


# 2. Recommendations from Play Console

## Task 5 — Fix Edge-to-Edge Display

* Ensure the game correctly supports edge-to-edge display on Android 15 and newer.
* Handle window insets correctly so that UI elements are not hidden behind system bars.
* Test the game on different screen sizes and Android versions.
* Consider using `enableEdgeToEdge()` for Kotlin or `EdgeToEdge.enable()` for Java for backward compatibility.

## Task 6 — Remove Deprecated Edge-to-Edge APIs

* Identify and remove any deprecated APIs or parameters related to edge-to-edge display and window configuration.
* Replace them with the currently supported Android APIs.

## Task 7 — Improve Large-Screen Support

* Remove unnecessary screen resizing and orientation restrictions.
* Ensure the game supports different screen configurations and large-screen devices.
* Test the game on different aspect ratios and screen sizes to ensure there are no layout issues.

## Task 8 — Investigate Intermittent Screen Slowdown

* Investigate reports from some users experiencing occasional screen slowdown.
* The issue does not appear to be a typical lag spike. Instead, the game can appear to run at a significantly lower refresh rate or frame rate, making the entire screen look slow.
* The issue only occurs on some devices and only occasionally.
* Verify that the slowdown is not caused by battery saver or similar power-saving features.
* Investigate whether this could be related to the Android 15 edge-to-edge/display changes recommended by Google Play Console.
* Check for possible rendering, frame-rate, screen refresh-rate, GPU, or device-specific issues.
* Test on different devices, refresh rates, Android versions, and screen configurations.
* Profile the game during the slowdown to identify potential frame-time spikes, rendering bottlenecks, or unintended frame-rate limitations.
