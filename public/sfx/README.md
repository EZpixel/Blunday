# Sound effects

`.wav` files loaded by `src/game/audio.js` (see `SOUNDS` there). Vite serves
this folder as-is. File and folder names are case-sensitive on the deployed site.

Files are sorted into folders by category:

| Folder               | What's in it                                   |
|----------------------|------------------------------------------------|
| `ui/`                | Menu and button sounds                         |
| `achievements/`      | Achievement unlock jingles                     |
| `gold/`              | Gold pickups                                   |
| `player/`            | The player's own sounds (jumping)              |
| `platforms/`         | Platform-specific sounds                       |
| `gameover/`          | End-of-run sounds                              |
| `powerups/<name>/`   | One folder per power-up                        |

Numbered files are variants of one sound (`Boots1`, `Boots2`, ...): one is
picked at random each time the sound starts. To add a variant, drop the file
in the sound's folder and add its path to the list in `SOUNDS`.

| Sound      | Files                                    | When it plays                                  |
|------------|------------------------------------------|------------------------------------------------|
| `click`    | `ui/Click`                               | Any button click                               |
| `upgrade`  | `ui/Upgrade1`                            | Buying an upgrade                              |
| `boots`    | `powerups/boots/Boots1`, `Boots2`        | Landing while wearing boots                    |
| `star`     | `powerups/star/Star1`                    | Picking up a star                              |
| `coin`     | `gold/Coin1`                             | Collecting any gold (coin, bag, bar, gems)     |
| `jump`     | `player/Jump1`                           | Landing on a platform (unless it breaks)       |
| `achievement` | `achievements/Achievement1`–`4`       | Unlocking an achievement                       |
| `jetpack`  | `powerups/jetpack/Jetpack1` (looped)     | While the jetpack is active                    |
| `umbrella` | `powerups/umbrella/Umbrella1` (looped)   | While the umbrella is active                   |
| `magnet`   | `powerups/magnet/MagneticField` (looped) | While the magnet is active                     |
| `wood`     | `platforms/WoodPlatform1`                | Landing breaks a wooden platform (no `jump`)   |
| `fall`     | `gameover/Fall1`                         | Game over                                      |
| `fart`     | `gameover/Fart`                          | Game over, with Experimental Mode on           |
