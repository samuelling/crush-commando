# Hollow Dash, the novel — a plan

## The idea
Jonathan Lethem's novels start inside a familiar genre and let another one leak in: a hardboiled
detective story with evolved animals, a Brooklyn coming-of-age with a magic ring, a love story
with a void. Hollow Dash should do the same thing *as you play*. It opens as exactly the cheerful
platformer it is now. The farther you run, the more a novel seeps in — a narrator, a city,
memory, strangeness — until the platformer is just one genre among several, and then the
technology itself starts to give out.

The player never stops running. The book happens around the run.

## Ground rules
- **Homage, not adaptation.** Every line of text is original. No quotations, no character names.
  Each chapter closes with a small card, "after *Title* (year)", crediting the book that inspired it.
- **Never pause the run.** Narration is a caption over play: two short lines max, fades on its own,
  never blocks input. A pause-menu toggle turns narration off.
- **Platforming stays fair.** Every new chunk and physics rule must pass the existing
  jump-feasibility validator and the look-ahead bot before it ships.
- **Phone first.** Captions sit top-center under the HUD, at least 16px, and never cover the
  touch zones. No control inversion or input glitches; those are unfair on a touchscreen.
- **Respect.** The noir narrator's compulsive wordplay is affectionate, a love of language. It is
  never a control glitch and never a joke at the expense of a real condition.

## The book: chapters by distance
About 1.6 km from start to epilogue. Each chapter is roughly three checkpoints, and themes
cross-fade over one chunk so changes feel like a drift, not a level switch.

| # | Chapter | Distance | After | What changes in play |
|---|---------|----------|-------|----------------------|
| 0 | **Genre** | 0–150 m | — | The game as it is today. One line of narration at the first checkpoint: the first hint someone is watching. |
| 1 | **The Tail** | 150–350 m | *Gun, with Occasional Music*; *Motherless Brooklyn* | Rain and sodium streetlights. Walkers wear hats and coats. Score is relabeled **Karma** and can be docked (falling costs karma). A hardboiled narrator whose sentences sometimes catch on a word and riff on it. |
| 2 | **Stoop Ball** | 350–550 m | *The Fortress of Solitude* | 1970s Brooklyn: brownstone tiles with stoops, fire escapes as platforms, a pink rubber ball as a bouncing hazard, comic-panel borders that flicker at the screen edges. Your own graffiti tag appears on walls at each checkpoint you pass. The chapter ends when you find a ring. |
| 3 | **Flight, Then Less** | 550–750 m | *The Fortress of Solitude* | The ring: hold jump to fly on a small meter. Halfway through, it turns. Flight goes and invisibility comes: enemies stop tracking you, your sprite fades, and the narrator starts losing track of you too. |
| 4 | **Dreamed Country** | 750–950 m | *Amnesia Moon* | The land is divided into territories shaped by whoever dreams them. A roadside sign announces each region's rule before it starts: low gravity, slow time, steady wind, everything slightly too small. |
| 5 | **The Lack** | 950–1150 m | *As She Climbed Across the Table* | A drifting void that swallows some things and refuses others. It has taste. Each run it picks a preference (coins, enemies, or platforms) and the narration hints at it. Learning its taste is the puzzle. |
| 6 | **The Gray** | 1150–1350 m | *Chronic City* | Fog eats the background from the far layers inward. Headlines scroll on billboards. Something tiger-shaped tunnels under the street, collapsing ground behind you and sometimes ahead (always telegraphed by cracks). A rare, almost-invisible vase to collect. |
| 7 | **The Arrest** | 1350–1550 m | *The Arrest* | Technology stops. The music thins to one voice, then silence. The HUD unbolts and falls off the screen. The double jump stops working. The sky stops cycling. Single jumps, quiet running, narration only; the level design softens to match. |
| E | **Influence** | 1550 m + | *The Ecstasy of Influence* | Collage: chunks, tiles and enemies from every chapter pasted together. The narrator admits everything here was borrowed. An acknowledgments card lists the books. Then an endless **afterword** continues with everything shuffled and the double jump restored. |

## The Mind (nobody dies)
There is no game over. When you run out of hearts, the page dissolves into words and you fall into
**the Mind**: the writer's head, drawn entirely in text. Sentences are the platforms, the background
is drifting vocabulary, and you are no longer the red runner but **a figment of an idea**, a glowing
label that grows from "a figment" to "a notion", "an idea", "a premise" and finally "a story".

- **Words are weight.** Collected words orbit the figment. Each one makes it heavier: it jumps a little
  lower and drifts down a little faster (hold jump to drift).
- **Two books.** Half the words come from the chapter you fell out of (amber), half from the next one
  (blue). The HUD shows both counts.
- **Literary gravity.** At 10 words the figment becomes a story, the sentences let go of their letters,
  and it falls into an open book: whichever book you carried more words from. Fall into the next
  book and you start the next chapter; fall into your own and you return to your last checkpoint.
- **Ways to leave early.** Touch a redaction bar and you are erased; drift off the bottom and you are
  forgotten. Either way you go back to your last checkpoint with full hearts.
- **Clichés** float over some sentences; touching one knocks a word loose.
- **Depth.** Behind the play space are many translucent layers moving at their own speeds: colored
  haze, giant faint words, a fabric of tiny words, clouds of words at two distances, slowly turning
  spirals and rings of words, rivers of words, loose words of every size, and a faint foreground
  layer drifting in front. The art is drawn once into offscreen canvases and the background is
  composited at reduced resolution, so it costs about the same as a regular chapter.

Code: `js/mind.js` (generation, figment physics, rendering), Mind lines and vocabulary in `js/story.js`.

## The Deep Mind (genre bend: Dreamed Country becomes a dungeon crawl)
Partway through Dreamed Country, after a checkpoint, a door stands ajar in a field with words
spilling out of it and a sign reading A DOOR INTO THE MIND. Walk through it and the platformer
becomes a turn-based dungeon crawl. Nothing needs reflexes: every turn is a decision.
"This was supposed to be a platformer. Now it's a dungeon crawl, and you're the one being written."

- **Explore by choosing.** Each floor is a small map of rooms. Tap a glowing door to go there: a foe,
  something odd, something left behind, a stoop to rest on, a bodega, or stairs down. Night Eyes shows
  what is behind every door.
- **Four floors.** The Lobby of First Drafts, Brooklyn Remembered, The Detective's Floor, and The
  County of Dreams, which ends at the Blank Page. Each floor has its own foes, rooms, and music.
- **Word-fights.** Foes are words from the books: a cliché, an adverb ("SUDDENLY"), writer's block,
  the big kid on the stoop, pigeons, a man who keeps changing, the hood, the inquisitor, a kangaroo in
  a good suit, a nightmare, a rule, the Lack (immune to plain strikes), the Blank Page. Each shows what
  it will do next. Answer with Strike (Wit), Guard (Nerve), Riff (spend words), or Ask a Question
  (once a fight, costs karma, exposes its weak spot), plus moves from boons.
- **Leveling.** Beating foes and odd rooms gives experience. Each level adds Heart and offers a choice
  of boons: Sharper (+Wit), Steadier (+Nerve), Thicker Skin (+Heart), the Ring, Second Thought, Wordplay, Stoop
  Ball, Collage, a Kangaroo in a Good Suit, Lucky Dime, Footnotes, Night Eyes, Insight.
- **Odd rooms.** Fourteen choice events in Lethem's register: a mirror made of paragraphs, a genre
  that wants to change you, a sheep in a cardigan who keeps karma, a tunneling tiger, a radio, a hole,
  the vase. Every option shows its odds or price.
- **Nobody dies.** Run out of Heart and you wake in the field next to the door. Each wake-up is
  remembered: the next attempt starts with a gift boon (up to two). Erase the Blank Page and you come
  up out of the mind onto the salt flats of Chapter Five, The Lack, with a karma bonus.
- **Controls.** Tap rooms and choices. On a keyboard, ◀ ▶ move the highlight and jump picks it.
- Debug: `?crawl` starts straight in the Deep Mind.

Code: `js/crawl.js` (pure logic: floors, foes, boons, events, balance), `js/crawlview.js` (DOM view),
crawl lines in `js/story.js`, the door in `js/level.js` and `js/render.js`.

## Systems to build
1. **Story engine** (`js/story.js`): chapter table keyed by distance; event triggers (first stomp,
   first fall, last heart, coin streak, checkpoint, entering a region); line pools that don't repeat
   within a run; typewriter caption reveal.
2. **Caption UI** (`index.html`, `css/style.css`): translucent strip under the HUD,
   `pointer-events: none` so touches pass through to the controls.
3. **Theme layer** (`js/render.js`): replace the four-palette day cycle with per-chapter themes
   (palette, tile skin, enemy skin, extra background layers such as skyline, rain, fog) and a
   cross-fade between them.
4. **Chapter-aware generator** (`js/level.js`): `chapterAt(col)`, per-chapter chunk weights, and new
   chunk types: stoops, fire escapes, region signs, collapse zones.
5. **New entities** (`js/game.js`): ring pickup with flight and invisibility states, the void,
   the tunneling tiger, the rubber ball, roadside signs, graffiti tags, the vase.
6. **Rule modifiers**: per-region gravity and time scale; the Arrest switches off double jump,
   HUD and day cycle.
7. **Music per chapter** (`js/audio.js`): noir walking bass in a minor key; soul-tinged swing for
   Brooklyn; a drone for the Gray; a fade to nothing for the Arrest; a collage of all of them for the
   epilogue.
8. **Bookmarks**: save the furthest chapter reached. The title screen offers "Continue from
   chapter N" or "From the beginning". Hearts refill at each chapter start. A novel has to be
   finishable on a phone.
9. **Settings**: narration on/off, caption text size.
10. **Testing**: extend the validator to the new chunks and physics modifiers; a debug
    `?chapter=N` start so the bot can play every chapter.

## Milestones
- [x] **M1 — The frame.** Story engine, captions, theme cross-fade, bookmarks, Prologue + Chapter 1.
- [x] **M2 — Brooklyn.** Chapters 2 and 3, ring flight and invisibility.
- [x] **M3 — Strange physics.** Chapters 4 and 5, dream regions and the void.
- [x] **M4 — The ending.** Chapters 6 and 7, the tiger, the Arrest, Epilogue and afterword mode.
- [x] **M5 — Revision.** Writing pass, music per chapter, narration and text-size settings, render-cost pass,
      adaptive resolution. Still open: tuning from real playtests on a phone.

All five shipped together. Verification used a physics-accurate jump validator over 200 generated books
(including worst-case tiger collapses and the single-jump Arrest), a look-ahead bot in every chapter,
targeted tests for each mechanic, and a full start-to-epilogue run.

## Decisions (taken)
1. **A finite book with a real ending**, followed by the endless afterword.
2. **The books are named** on the "after …" chapter cards and on the acknowledgments card.
3. **Claude drafted every line**; all narration lives in `js/story.js` for editing.

## Where things live
- `js/chapters.js` — chapter table: start distance, theme, music, tile skin, chunk weights, rule caps.
- `js/story.js` — every line of narration, sign text, headlines, and the caption engine.
- `js/level.js` — chunk generator; new chunks: `gate`, `ball`, `sign`, `lack`, `collapse`, `billboard`, `vase`.
- `js/game.js` — chapter beats (`chapterBeats`, `enterChapter`), ring, void, cracks, dream rules.
- `js/render.js` — themes, skylines, tile skins, overlays (rain, fog, comic panel, dream tint).
- `js/audio.js` — one arrangement per chapter plus layers the Arrest strips away, and the Mind's music.
- `js/mind.js` — the Mind: the level you fall into instead of dying.
- `js/crawl.js`, `js/crawlview.js` — the Deep Mind: Dreamed Country's dungeon crawl.
- Debug: append `?chapter=N` (0–8) to the URL to start at a chapter.
