# Hollow Dash

A side-scrolling platformer for the web, built for phones, that slowly turns into a novel as you run.
It opens as a cheerful platformer; over about 1.6 km it drifts through eight chapters written in homage
to Jonathan Lethem's books, reaches an ending, and continues as an endless afterword.
Nobody dies: run out of hearts and you fall into the writer's mind, a level drawn entirely in words,
where you play as a figment of an idea gathering words until it is heavy enough to fall into a book.
Partway through Dreamed Country the genre bends: a door in a field opens into the Deep Mind, a
turn-based dungeon crawl of choices, word-fights and level-ups. No reflexes, just decisions.
No dependencies, no build step.

**Play:** https://crumplabsandbox.github.io/SideScroller/

## Controls
- **Phone:** left side of the screen = ◀ ▶ (left 30% / next 25%), right side = jump. Hold to jump higher, tap again mid-air to double jump. Multi-touch works.
- **Keyboard:** ← → or A D to move, Space / ↑ / W to jump, P or Esc to pause, M to mute.

Your furthest chapter is saved, so you can continue from it. Narration and caption size can be changed
from the pause menu. Add `?chapter=N` (0–8) to the URL to jump straight to a chapter, or `?crawl` to start in the Deep Mind.

## Run locally
```sh
python3 -m http.server 8000
# open http://localhost:8000
```
(ES modules need http://, not file://.)

## Deploy
`.github/workflows/deploy.yml` deploys the repo root to GitHub Pages on every push to `main`. Live: https://crumplabsandbox.github.io/SideScroller/
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

See [plan.md](plan.md) for the design and architecture.
