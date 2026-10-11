# Crush Commando

A run-and-gun platformer about one man fighting his way down through his memories of failed crushes, all the way to the Heartbreak Core, where he plants a very large explosive. He wins. That's the tragedy: with the hurt gone, so is everything else, and he comes out strong, glossy and alone, livestreaming his framework for women to a million strangers.

It plays side-on like Contra. In parts of every mission the camera drops into first person and the flat level turns out to be one slice of a wider 3D canyon. You can step off the path into hidden lanes with their own terrain, enemies and weapon caches.

**Play together:** https://samuelling.github.io/crush-commando/ (once the deploy below is set up)

`cc/index.html` is Crush Commando on its own: a single self-contained file you can open straight from disk.

## Crush Commando × Hollow Dash

The front page (`index.html`) joins this game with **Hollow Dash** by [CrumpLabSandbox](https://github.com/CrumpLabSandbox/SideScroller), an endless platformer that slowly turns into a novel. The two are linked by **rifts**, and you can play them **online with friends**.

- **Rifts:** the first mission of every Crush Commando world has a rift. Each one is paired with a rift in a Hollow Dash chapter: Recess Grove ↔ *Genre*, Unsent Letter Caves ↔ *The Tail*, Left-on-Read Spires ↔ *Flight, Then Less*, Cold Shoulder Peaks ↔ *The Gray*, and The Heartbreak Core ↔ *The Lack*. Walk into one and you come out beside its twin in the other game. Each game stays where you left it.
- **Rooms:** everyone who opens the same invite link is in the same room, up to 8 players. When you're in the same stage (or the same stretch of Hollow Dash road), you see each other live, with names over your heads, in side view and in first person.
- **Co-op:** both players get the same enemies. A kill by anyone counts for everyone, your friend's bullets hit what's on your screen, boss damage is shared, and the first player into a stage spawns the troopers for the room. Pickups and Mixtapes are each player's own.
- **Join a friend:** press **G** (or tap **Join** in the bar at the top) to warp next to a friend, through a rift if they're in the other game.

How it fits together: the hub page loads each game in a frame and owns a WebSocket to a small relay server. Each game talks to the hub through `postMessage` (`src/net.js` and `hd/js/hub.js`). The server is a Cloudflare Durable Object, one per room, that relays positions and game events. Levels are seeded the same way for everyone, so both players walk the same world.

## The game

- **5 missions, 20 stages:** three stages and a memory boss each. In order: Recess Grove, Unsent Letter Caves, Left-on-Read Spires, Cold Shoulder Peaks, and The Heartbreak Core.
- **Weapons:** 8-way aiming, hold to auto-fire, crouch to duck shots. Flying pods drop the Spread Gun, Machine Gun, Laser and Flamethrower.
- **Moves unlocked by beating bosses:** double jump, dash, wall jump, glide.
- **Collectibles:** Confidence sparks, plus 3 hidden Mixtapes per stage (45 total).
- **The enemies are memories of crushes:** faded, flickering kids with hairstyles you'd recognise anywhere and cheeks that still blush. There are unsent love letters that flap like moths, a phone that fires "Seen" bubbles, and the letterman-jacket guy she chose instead. Each boss takes a feeling with it when it dies.
- **Your real weather:** the game looks up your rough location (from your internet address, no prompt) and current conditions from Open-Meteo. Day, dusk, night and dawn follow the real sun. Rain, snow, fog, cloud and thunderstorms fall in side view and first person. You can switch it off in the pause menu, or preview any state with `?weather=rain|drizzle|storm|snow|fog|cloudy|clear&hour=21.5`.
- **First-person music by bellweather:** in 3D zones the soundtrack becomes a WebAudio port of [bellweather](https://github.com/samuelling/bellweather), Sam's weather-driven norns drone bell. It has the drone that opens up by day and closes down at night, wind and gusts, Karplus-Strong plucks (snappy for rain, soft for snow) whose density follows the chance of rain, and the six-partial bell. It runs on the same live weather.
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

In first person you can look around freely:

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Look | Mouse (click the game to lock it), or ← → / Q E to turn | Right stick | Drag on the screen |
| Walk | W S or ↑ ↓ | Left stick | Pad up/down |
| Strafe | A D | Left stick | Pad left/right |

You walk in whatever direction you face, so you can head straight off the path into the hidden lanes. Shots fly where you aim, including up and down.

## Layout

```
index.html            the combined game: lobby, both games in frames, rifts, multiplayer connection
mp-config.js          multiplayer server address (filled in by the deploy workflow)
cc/index.html         Crush Commando, built from src/
hd/                   Hollow Dash (from CrumpLabSandbox/SideScroller, plus hd/js/hub.js and hubcfg.js)
server/
  room.js             room logic: join order, state relay, events
  worker.js           Cloudflare Worker + Durable Object that runs room.js
  dev.js              local server: serves the site and runs room.js, no dependencies
  wrangler.toml       Cloudflare config
src/
  head.html           page markup, styles, touch controls
  core.js             constants, RNG, tile collision, player physics
  chunks.js           hand-made level pieces (ASCII), boss arenas
  levelgen.js         stage assembly from chunks, mission names
  audio.js            WebAudio sound effects and procedural music
  render.js           themes, parallax backgrounds, tile art, lighting
  entities.js         enemies, pickups, platforms
  bosses.js           the five memory bosses
  fps.js              first-person raycaster, free-look controls, hidden 3D lanes
  combat.js           weapons, bullets, troopers, weapon pods, hero art
  memories.js         the enemies drawn as crush memories, their shots, photo-scrap deaths
  weather.js          live local weather and time of day: sky, light, rain, snow, fog, lightning
  bell.js             first-person music: WebAudio port of bellweather's WeatherBell engine
  net.js              rifts, friends, shared kills (combined game only)
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
node server/dev.js                   # play locally with multiplayer at http://localhost:8787/
./tools/build.sh                     # rebuild cc/index.html after editing src/
node tools/check-chunks.js           # verify every side-view chunk is beatable
node tools/check-chunks.js --fp      # same for first-person chunks
python3 tests/playthrough_bots.py    # needs: pip install playwright && playwright install chromium
```

The chunk solver runs the game's real player physics headlessly. It searches the inputs a player could press and confirms each chunk can be crossed, and each Mixtape reached, with only the moves available in the worlds where that chunk appears.

Level pieces are ASCII maps in `src/chunks.js`; the legend is at the top of that file. Stages are assembled from them by a seeded generator, so every stage is the same on every playthrough.

## Deploying (free)

`.github/workflows/deploy.yml` runs on every push to `main`. It deploys the room server to Cloudflare Workers, writes its address into `mp-config.js`, and publishes the site to GitHub Pages. One-time setup:

1. Make a free Cloudflare account. Copy your **Account ID** from *Workers & Pages → Account details*.
2. In Cloudflare, go to *Manage account → Account API tokens → Create Token* and use the **Edit Cloudflare Workers** template.
3. In GitHub, go to *Settings → Secrets and variables → Actions* and add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. In GitHub, go to *Settings → Pages* and set *Source* to **GitHub Actions**.

Without the Cloudflare secrets the site still deploys, in solo mode with working rifts.

The free Workers plan covers roughly 14 hours of two-player play a day. Positions are sent 15 times a second, and incoming WebSocket messages are billed at 20 per request against 100,000 requests a day.
