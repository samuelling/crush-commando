# Hollow Dash — a mobile-first web side scroller

## Goal
A fast, polished, endless side-scrolling platformer that runs in any modern browser,
feels great on a phone (touch controls, landscape, fullscreen, add-to-home-screen),
and deploys automatically to GitHub Pages on every push. Zero dependencies, zero build step.

## Design pillars
1. **Feels great in the hand** — big forgiving touch zones, variable-height jumps, coyote time,
   jump buffering, double jump, squash/stretch, particles, screen shake.
2. **Always something new** — procedurally generated chunks (gaps, platforms, spikes, movers,
   stairs, walkers, bats), difficulty ramps with distance, day/night cycle as you run.
3. **Fair** — three hearts, checkpoints every few chunks, brief invulnerability after a hit,
   a safe starting stretch.
4. **Juicy but tiny** — hand-drawn vector art on canvas, synthesized sound (no asset downloads),
   whole game is a handful of small files.

## Architecture (plain ES modules, no bundler)
```
index.html             shell: canvas, HUD, touch layer, title / pause / game-over screens
css/style.css          full-screen layout, safe-area insets, HUD + overlay styling
js/main.js             bootstrap, resize/DPR scaling, fixed-step loop, HUD/overlay wiring, PWA
js/game.js             Game state machine, Player physics, enemies, platforms, pickups, camera, chapter beats
js/level.js            tile grid + procedural chunk generator (chapter- and difficulty-aware)
js/chapters.js         the book: chapter table (see novel-plan.md)
js/story.js            narration lines, Mind vocabulary, and caption engine
js/mind.js             the Mind: the all-text level you fall into instead of dying
js/crawl.js            the Deep Mind: turn-based dungeon crawl logic (floors, foes, boons, events)
js/crawlview.js        the Deep Mind's tap-to-choose view (map, foe, log, choice buttons)
js/render.js           per-chapter themes, parallax layers, tile skins, sprites, particles, overlays
js/input.js            keyboard + multi-touch zones (left / right / jump) with edge detection
js/audio.js            WebAudio synth SFX + per-chapter music arrangements, mute persisted
js/util.js             rng, lerp, clamp, color helpers
manifest.webmanifest   installable PWA (landscape, standalone)
sw.js                  network-first service worker for offline play
.github/workflows/deploy.yml   GitHub Pages deploy via Actions
```

## Gameplay spec
- **World**: 48px tiles, 14 rows tall, infinite to the right. Camera scrolls forward only
  (left edge is a soft wall), follows vertically with smoothing.
- **Player**: run accel/friction, max speed 290px/s, jump -720px/s (≈2.3 tiles), double jump,
  jump cut on release, 90ms coyote time, 120ms jump buffer. Stomping enemies bounces you.
- **Hazards**: pits (lose a heart, respawn at checkpoint), spikes and enemy contact
  (lose a heart, knockback, 1.6s invulnerability). 0 hearts → you fall into the Mind (no game over).
- **Pickups**: coins (+10), hearts (rare, on a high platform at checkpoints), checkpoint flags.
- **Score**: distance (m) + coins×10 + stomps×25. Best score saved in localStorage.
- **Chunks**: flat, gap, platforms, spikes, stairs, walkers, moving platform, bats, checkpoint.
  Pool widens and gaps grow with difficulty (0→1 over ~45 chunks). Every jump is validated
  against jump capability (rise ≤1 tile on wide gaps, ≤2 on narrow ones).

## Controls
- **Touch**: left 30% of screen = ◀, next 25% = ▶, right 45% = jump. Multi-touch, slide between
  zones, hold for higher jumps. On-screen hints show active zones.
- **Keyboard**: ← → / A D to move, Space / ↑ / W / Z / K to jump, P or Esc to pause, M to mute.

## Deployment
- Push to `main` → `deploy.yml` uploads the repo root as a Pages artifact
  and deploys it. Repo setting required once: *Settings → Pages → Source: GitHub Actions*.
- Live URL: `https://<owner>.github.io/<repo>/`. All asset paths are relative so it works from a
  sub-path.

## Milestones
- [x] Plan
- [x] Core loop, canvas scaling, input zones
- [x] Player physics + tile collision + moving platforms
- [x] Procedural level generator with difficulty ramp
- [x] Enemies (walker, bat), spikes, coins, hearts, checkpoints
- [x] Rendering: parallax day/night sky, tiles, sprites, particles, shake
- [x] Audio: SFX + music, mute toggle
- [x] HUD, title / pause / game-over screens, best score
- [x] PWA manifest + service worker, fullscreen + orientation lock attempt
- [x] GitHub Actions → Pages workflow
- [x] Smoke test in headless Chromium (no console errors, game starts, player moves)

## The novel (built)
See [novel-plan.md](novel-plan.md): the game slowly turns into a Jonathan Lethem novel as you run.

## Ideas for later
- Dash / wall-jump, more enemy types, boss gates every N checkpoints
- Daily seed mode with shareable link (`?seed=`)
- Gamepad support, haptics via `navigator.vibrate`
- Leaderboard (needs a backend or GitHub Discussions trick)
