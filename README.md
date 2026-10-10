# Crush Commando

A run-and-gun platformer about one man fighting his way down through his bad memories of failed crushes, all the way to the Heartbreak Core, where he plants a very large explosive.

It plays side-on like Contra. In parts of every mission the camera drops into first person and the flat level turns out to be one slice of a wider 3D canyon. You can step off the path into hidden lanes with their own terrain, enemies and weapon caches.

Open `index.html` in a browser to play. It is a single self-contained file with no build step needed to run it, and it works with GitHub Pages as-is.

## The game

- **5 missions, 20 stages:** three stages and a memory boss each. In order: Recess Grove, Unsent Letter Caves, Left-on-Read Spires, Cold Shoulder Peaks, and The Heartbreak Core.
- **Weapons:** 8-way aiming, hold to auto-fire, crouch to duck shots. Flying pods drop the Spread Gun, Machine Gun, Laser and Flamethrower.
- **Moves unlocked by beating bosses:** double jump, dash, wall jump, glide.
- **Collectibles:** Confidence sparks, plus 3 hidden Mixtapes per stage (45 total).
- **Extras:** procedural chiptune music and sound, saves in the browser, and keyboard, gamepad and touch controls.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move / aim | Arrows or WASD | Stick / D-pad | Pad |
| Jump | Z / Space | A | JUMP |
| Fire (hold) | X / J / click | X / B | FIRE |
| Dash | Shift / C | Bumpers | DASH |
| Pause | Esc / P | Start | ❚❚ |
| Mute music | M | | |

In first person, Up and Down walk forward and back, and Left and Right step sideways between lanes.

## Layout

```
index.html            built game (generated from src/)
src/
  head.html           page markup, styles, touch controls
  core.js             constants, RNG, tile collision, player physics
  chunks.js           hand-made level pieces (ASCII), boss arenas
  levelgen.js         stage assembly from chunks, mission names
  audio.js            WebAudio sound effects and procedural music
  render.js           themes, parallax backgrounds, tile art, lighting
  entities.js         enemies, pickups, platforms
  bosses.js           the five memory bosses
  fps.js              first-person renderer and the hidden 3D lanes
  combat.js           weapons, bullets, troopers, weapon pods, hero art
  story.js            intro, mission briefings, ending text
  main.js             input, scenes, HUD, menus, main loop
tools/
  build.sh            bundles src/ into index.html
  check-chunks.js     reachability solver for level pieces
tests/
  playthrough_bots.py headless bots that clear every stage and boss
```

## Development

```sh
./tools/build.sh                     # rebuild index.html after editing src/
node tools/check-chunks.js           # verify every side-view chunk is beatable
node tools/check-chunks.js --fp      # same for first-person chunks
python3 tests/playthrough_bots.py    # needs: pip install playwright && playwright install chromium
```

The chunk solver runs the game's real player physics headlessly. It searches the inputs a player could press and confirms each chunk can be crossed, and each Mixtape reached, with only the moves available in the worlds where that chunk appears.

Level pieces are ASCII maps in `src/chunks.js`; the legend is at the top of that file. Stages are assembled from them by a seeded generator, so every stage is the same on every playthrough.
