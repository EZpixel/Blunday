# Sound effects

`.wav` files loaded by `src/game/audio.js` (see `SOUNDS` there). Vite serves
this folder as-is. File names are case-sensitive on the deployed site.

Numbered files are variants of one sound (`Boots1`, `Boots2`, ...): one is
picked at random each time the sound starts. To add a variant, drop the file
here and add its name to the list in `SOUNDS`.

| Sound      | Files                  | When it plays                                  |
|------------|------------------------|------------------------------------------------|
| `click`    | `Click`                | Any button click                               |
| `upgrade`  | `Upgrade1`             | Buying an upgrade                              |
| `boots`    | `Boots1`, `Boots2`     | Picking up boots                               |
| `star`     | `Star1`                | Picking up a star                              |
| `coin`     | `Coin1`                | Collecting any gold (coin, bag, bar, gem)      |
| `jump`     | `Jump1`                | Landing on a platform (unless it breaks)       |
| `achievement` | `Achievement1`–`4`  | Unlocking an achievement                       |
| `jetpack`  | `Jetpack1` (looped)    | While the jetpack is active                    |
| `umbrella` | `Umbrella1` (looped)   | While the umbrella is active                   |
| `wood`     | `WoodPlatform1`        | Landing breaks a wooden platform (no `jump`)   |
| `fall`     | `Fall1`                | Game over                                      |
| `fart`     | `Fart`                 | Game over, with Experimental Mode on           |
