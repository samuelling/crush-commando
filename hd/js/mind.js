// The Mind: a level drawn entirely in words, inside the writer's head.
// You arrive here instead of dying. You are a figment of an idea: collect words, grow heavy,
// and when you carry enough literary gravity you fall into a book. Whichever book you carried
// more words from is the one you fall into.
import { clamp, lerp, hash2, mulberry32 } from './util.js';
import { CHAPTERS } from './chapters.js';
import { WORDS, SENTENCES, CLICHES } from './story.js';

export const MIND_GOAL = 10;
const FONT = '600 17px Georgia, "Times New Roman", serif';
const WORD_FONT = '700 16px Georgia, "Times New Roman", serif';
const CLICHE_FONT = 'italic 15px Georgia, "Times New Roman", serif';
const INK = '#ece4cf';
const BOOK_COLORS = ['#ffc861', '#7fe0ff'];      // 0: the book you fell out of, 1: the next book
const BOOK_RGB = [[255, 200, 97], [127, 224, 255]];
const STAGES = [[0, 'a figment'], [3, 'a notion'], [5, 'an idea'], [8, 'a premise'], [MIND_GOAL, 'a story']];
const DEATH_Y = 650;
const ALL_WORDS = Object.values(WORDS).flat();
const BG_RES = 1;      // background resolution in pixels per world unit

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

export class Mind {
  constructor({ from, next, input, sound, story }) {
    this.from = from;
    this.next = next;
    this.single = from === next;
    this.books = [CHAPTERS[from], CHAPTERS[next]];
    this.input = input; this.sound = sound; this.story = story;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.measure = document.createElement('canvas').getContext('2d');
    this.platforms = []; this.words = []; this.erasers = []; this.cliches = [];
    this.particles = []; this.texts = [];
    this.carried = [];
    this.f = { x: 150, y: -140, vx: 0, vy: 0, r: 14, grounded: false, coyote: 0, buffer: 0, air: 1, cut: true, invuln: 0 };
    this.cam = { x: 0, y: 20 };
    this.state = 'play';
    this.t = 0; this.time = 0;
    this.result = null;
    this.fade = 1; this.flash = 0;
    this.stage = 0;
    this.book = null;
    this.genX = 0; this.lastY = 330;
    this._startPlatform();
  }

  get count() { return this.carried.length; }
  get label() { let l = STAGES[0][1]; for (const [n, s] of STAGES) if (this.count >= n) l = s; return l; }
  bookCount(b) { return this.carried.filter((w) => w.book === b).length; }

  width(text, font) { this.measure.font = font; return Math.ceil(this.measure.measureText(text).width); }

  sentence() {
    const r = this.rng;
    const vocab = [...WORDS[this.books[0].key], ...WORDS[this.books[1].key], ...WORDS.mind];
    return pick(r, SENTENCES).replace('{a}', pick(r, vocab)).replace('{b}', pick(r, vocab));
  }

  _startPlatform() {
    const text = 'you fell out of the story and into the mind that was writing it';
    const w = this.width(text, FONT);
    this.platforms.push({ x: 40, y: 330, w, text });
    this.genX = 40 + w;
    this.addWord(40 + w * 0.7, 280, 0);
  }

  addWord(x, y, book) {
    if (this.single) book = 0;
    if (book == null) book = this.rng() < 0.5 ? 0 : 1;
    const text = pick(this.rng, WORDS[this.books[book].key]);
    this.words.push({ x, y, text, book, w: this.width(text, WORD_FONT), phase: this.rng() * 6.28 });
  }

  _gen() {
    const r = this.rng;
    const gap = 40 + r() * 90;
    const x = this.genX + gap;
    const y = clamp(this.lastY + (r() * 130 - 60), 170, 470);
    const text = this.sentence();
    const w = this.width(text, FONT);
    this.platforms.push({ x, y, w, text });
    const n = this.platforms.length;
    const midX = this.genX + gap / 2, topY = Math.min(this.lastY, y);
    // words along the sentence at walking height, plus a higher one worth jumping for
    const k = w > 260 ? 2 : 1;
    for (let i = 0; i < k; i++) if (r() < 0.85) this.addWord(x + (w * (i + 0.5)) / k, y - 24);
    if (r() < 0.5) this.addWord(x + w * (0.3 + r() * 0.4), y - 72 - r() * 30);
    if (n > 2 && r() < 0.4) this.addWord(midX, topY - 60 - r() * 40);
    if (n > 3 && r() < 0.14) {
      this.erasers.push({ x: midX - 34, y0: topY - 50, y: topY - 50, amp: 60, period: 2.6 + r(), phase: r() * 6.28, w: 68, h: 22 });
    } else if (n > 4 && r() < 0.22) {
      const t = pick(r, CLICHES);
      const cw = this.width(t, CLICHE_FONT);
      this.cliches.push({ x0: x + w / 2 - cw / 2, x: x + w / 2 - cw / 2, y: y - 40, text: t, w: cw, h: 18, amp: Math.min(70, w / 3), period: 3 + r() * 2, phase: r() * 6.28 });
    }
    this.genX = x + w;
    this.lastY = y;
  }

  // ---- update -----------------------------------------------------------------
  step(dt, VW, VH) {
    this.time += dt; this.t += dt;
    this.fade = Math.max(0, this.fade - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    while (this.genX < this.cam.x + VW * 2) this._gen();
    for (const e of this.erasers) e.y = e.y0 + Math.sin(this.time * 6.283 / e.period + e.phase) * e.amp;
    for (const c of this.cliches) c.x = c.x0 + Math.sin(this.time * 6.283 / c.period + c.phase) * c.amp;
    for (const q of this.particles) { q.life -= dt; q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);

    if (this.state === 'erased' || this.state === 'forgotten') {
      if (this.t > 0.9) this.result = { type: 'back', reason: this.state };
      this.camera(dt, VW, VH);
      return;
    }
    if (this.state === 'book') {
      if (this.t > 0.7) this.result = { type: 'book', chapter: this.dest };
      return;
    }
    if (this.state === 'gravity' && this.t > 1.1) this.beginFall();

    const f = this.f, inp = this.input, m = this.count;
    const falling = this.state === 'falling';
    f.invuln = Math.max(0, f.invuln - dt);

    const dir = inp.dir;
    const maxV = falling ? 120 : 240;
    if (dir) f.vx = clamp(f.vx + dir * 1800 * dt, -maxV, maxV);
    else { const fr = 1600 * dt; f.vx = Math.abs(f.vx) <= fr ? 0 : f.vx - Math.sign(f.vx) * fr; }

    if (inp.consumeJump()) f.buffer = 0.12; else f.buffer -= dt;
    if (f.grounded) { f.coyote = 0.1; f.air = 1; } else f.coyote -= dt;
    if (!falling && f.buffer > 0 && (f.coyote > 0 || f.air > 0)) {
      if (f.coyote <= 0) f.air--;
      f.vy = -(560 - 6 * m);
      f.coyote = 0; f.buffer = 0; f.grounded = false; f.cut = false;
      this.sound.play('jump');
      this.burstText(f.x, f.y + f.r, '·', 4, '#ece4cf');
    }
    if (!inp.jumpHeld && f.vy < 0 && !f.cut) { f.vy *= 0.5; f.cut = true; }

    const g = falling ? 2200 : 1100 + 60 * m;
    f.vy += g * dt;
    if (!falling && inp.jumpHeld && f.vy > 0) f.vy = Math.min(f.vy, 70 + 12 * m);   // drift
    f.vy = Math.min(f.vy, 900);
    const prevBottom = f.y + f.r;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.grounded = false;
    if (!falling && f.vy >= 0) {
      for (const p of this.platforms) {
        if (f.x > p.x - 14 && f.x < p.x + p.w + 14 && prevBottom <= p.y + 2 && f.y + f.r >= p.y) {
          f.y = p.y - f.r; f.vy = 0; f.grounded = true;
        }
      }
    }

    // gather words
    for (const w of this.words) {
      if (w.taken) continue;
      const wy = w.y + Math.sin(this.time * 2 + w.phase) * 4;
      if (Math.abs(f.x - w.x) < f.r + w.w / 2 && Math.abs(f.y - wy) < f.r + 12) this.take(w, wy);
    }
    if (this.words.some((w) => w.taken)) this.words = this.words.filter((w) => !w.taken);

    if (!falling && this.state === 'play') {
      if (f.invuln <= 0) {
        for (const e of this.erasers) {
          if (f.x + f.r > e.x && f.x - f.r < e.x + e.w && f.y + f.r > e.y && f.y - f.r < e.y + e.h) { this.erase(); return; }
        }
        for (const c of this.cliches) {
          if (f.x + f.r > c.x && f.x - f.r < c.x + c.w && f.y + f.r > c.y && f.y - f.r < c.y + c.h) { this.clicheHit(c); break; }
        }
      }
      if (f.y > DEATH_Y) { this.state = 'forgotten'; this.t = 0; this.sound.play('fall'); }
    }
    if (falling && this.book && f.y + f.r >= this.book.y + 30) {
      this.state = 'book'; this.t = 0; this.flash = 1;
      this.sound.play('page');
    }
    this.camera(dt, VW, VH);
  }

  camera(dt, VW, VH) {
    const f = this.f;
    const tx = f.x - VW * 0.35;
    const ty = this.state === 'falling' ? f.y - VH * 0.45 : clamp(f.y - VH * 0.55, -200, DEATH_Y - VH + 40);
    const k = 1 - Math.exp(-dt * 5);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, this.state === 'falling' ? 1 - Math.exp(-dt * 9) : k);
  }

  take(w, wy) {
    w.taken = true;
    this.carried.push({ text: w.text, book: w.book });
    this.sound.play('word');
    for (const ch of w.text) this.particles.push({ x: w.x - w.w / 2 + Math.random() * w.w, y: wy, vx: (this.f.x - w.x) * 2, vy: (this.f.y - wy) * 2 - 40, life: 0.45, max: 0.45, ch, color: BOOK_COLORS[w.book] });
    const stage = STAGES.filter(([n]) => this.count >= n).length - 1;
    if (stage > this.stage) {
      this.stage = stage;
      if (stage < STAGES.length - 1) this.story.special('stage' + stage);
    }
    if (this.count >= MIND_GOAL && this.state === 'play') this.startGravity();
  }

  clicheHit(c) {
    const f = this.f;
    f.invuln = 1.2;
    f.vy = -320;
    f.vx = f.x < c.x + c.w / 2 ? -200 : 200;
    const lost = this.carried.pop();
    this.sound.play('hurt');
    if (lost) {
      this.texts.push({ x: f.x, y: f.y - 24, text: lost.text, life: 1, vy: 60, color: '#ff8f8f', strike: true });
      this.stage = STAGES.filter(([n]) => this.count >= n).length - 1;
    }
    this.story.event('cliche');
  }

  erase() {
    this.state = 'erased'; this.t = 0;
    this.sound.play('erase');
    for (const ch of this.label) this.particles.push({ x: this.f.x + (Math.random() - 0.5) * 30, y: this.f.y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 200, g: 500, life: 1, max: 1, ch, color: '#ff8f8f' });
    this.story.event('erased');
  }

  startGravity() {
    this.state = 'gravity'; this.t = 0;
    const a = this.bookCount(0), b = this.bookCount(1);
    this.dest = !this.single && b > a ? this.next : this.from;
    this.sound.play('ding');
    this.story.special('gravity');
  }

  beginFall() {
    this.state = 'falling'; this.t = 0;
    const f = this.f;
    const w = 480, h = 150;
    this.book = { x: f.x - w / 2, y: Math.max(f.y + 460, DEATH_Y + 120), w, h, ch: CHAPTERS[this.dest] };
    f.vx = 0;
    // the sentences let go of their letters as the figment falls through them
    for (const p of this.platforms) {
      if (Math.abs(p.x + p.w / 2 - f.x) > 700) continue;
      for (let i = 0; i < p.text.length; i += 3) {
        this.particles.push({ x: p.x + (i / p.text.length) * p.w, y: p.y + 8, vx: (Math.random() - 0.5) * 40, vy: Math.random() * 60, g: 300, life: 1.6, max: 1.6, ch: p.text[i], color: INK });
      }
    }
  }

  burstText(x, y, ch, n, color) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 60, life: 0.35, max: 0.35, ch, color });
  }

  // ---- render -----------------------------------------------------------------
  render(ctx, VW, VH) {
    // The background is many translucent layers; it is drawn at a lower resolution into its own
    // canvas (cheap, and the softness reads as depth of field), then placed in one step.
    const bw = Math.ceil(VW * BG_RES), bh = Math.ceil(VH * BG_RES);
    if (!this.bg || this.bg.width !== bw || this.bg.height !== bh) {
      this.bg = document.createElement('canvas');
      this.bg.width = bw; this.bg.height = bh;
    }
    const b = this.bg.getContext('2d');
    b.setTransform(BG_RES, 0, 0, BG_RES, 0, 0);
    const g = b.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#1b1531');
    g.addColorStop(1, '#07060e');
    b.fillStyle = g;
    b.fillRect(0, 0, VW, VH);
    this.drawBackgroundWords(b, VW, VH);
    b.globalAlpha = 1;
    b.fillStyle = 'rgba(7,6,14,0.2)';   // push the background back so the playable words stand out
    b.fillRect(0, 0, VW, VH);
    ctx.drawImage(this.bg, 0, 0, VW, VH);

    ctx.save();
    ctx.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
    const x0 = this.cam.x - 80, x1 = this.cam.x + VW + 80;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const dissolving = this.state === 'falling' || this.state === 'book';
    ctx.font = FONT;
    for (const p of this.platforms) {
      if (p.x + p.w < x0 || p.x > x1) continue;
      ctx.globalAlpha = dissolving ? Math.max(0, 1 - this.t * 1.5) : 1;
      ctx.fillStyle = INK;
      ctx.fillText(p.text, p.x, p.y + 1);
      ctx.fillStyle = 'rgba(236,228,207,0.22)';
      ctx.fillRect(p.x, p.y + 21, p.w, 1);
    }
    ctx.globalAlpha = 1;

    ctx.font = WORD_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const w of this.words) {
      if (w.x + w.w < x0 || w.x - w.w > x1) continue;
      const y = w.y + Math.sin(this.time * 2 + w.phase) * 4;
      ctx.shadowColor = BOOK_COLORS[w.book];
      ctx.shadowBlur = 12;
      ctx.fillStyle = BOOK_COLORS[w.book];
      ctx.fillText(w.text, w.x, y);
    }
    ctx.shadowBlur = 0;

    for (const e of this.erasers) {
      if (e.x + e.w < x0 || e.x > x1) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.font = '700 12px Georgia, serif';
      ctx.fillStyle = '#d9d2c3';
      ctx.fillText('deleted', e.x + e.w / 2, e.y + e.h / 2 + 1);
      ctx.fillStyle = '#e0453a';
      ctx.fillRect(e.x - 4, e.y + e.h / 2, e.w + 8, 2);
    }

    ctx.font = CLICHE_FONT;
    for (const c of this.cliches) {
      if (c.x + c.w < x0 || c.x > x1) continue;
      ctx.fillStyle = '#ff8f8f';
      ctx.fillText(c.text, c.x + c.w / 2, c.y + c.h / 2);
      ctx.strokeStyle = 'rgba(255,143,143,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= c.w; x += 4) ctx.lineTo(c.x + x, c.y + c.h + Math.sin(x * 0.6 + this.time * 6) * 1.5);
      ctx.stroke();
    }

    if (this.book) this.drawBook(ctx);
    if (this.state !== 'erased') this.drawFigment(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const q of this.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.font = '600 13px Georgia, serif';
      ctx.fillText(q.ch, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life / 0.4));
      ctx.font = '700 14px Georgia, serif';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      if (t.strike) { const tw = ctx.measureText(t.text).width; ctx.fillRect(t.x - tw / 2, t.y, tw, 1.5); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawForegroundWords(ctx, VW, VH);
    this.drawHud(ctx, VW);
    const dark = Math.max(this.fade, this.state === 'forgotten' || this.state === 'erased' ? Math.min(1, this.t / 0.8) : 0);
    if (dark > 0) { ctx.fillStyle = `rgba(7,6,14,${dark})`; ctx.fillRect(0, 0, VW, VH); }
    const white = this.state === 'book' ? Math.min(1, this.t / 0.5) : this.flash;
    if (white > 0) { ctx.fillStyle = `rgba(250,245,232,${white})`; ctx.fillRect(0, 0, VW, VH); }
  }

  // Many translucent layers of words, back to front, each moving at its own depth.
  drawBackgroundWords(ctx, VW, VH) {
    const A = getArt();
    const cam = this.cam, t = this.time;
    // grid helper: place things on a 2D grid in each layer's own parallax space
    const grid = (L, fn) => {
      const ox = cam.x * L.f + t * (L.drift || 0), oy = cam.y * L.f * 0.6;
      const i0 = Math.floor((ox - L.pad) / L.sx), i1 = Math.ceil((ox + VW + L.pad) / L.sx);
      const j0 = Math.floor((oy - L.pad) / L.sy), j1 = Math.ceil((oy + VH + L.pad) / L.sy);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          if (hash2(i * 13 + L.seed, j * 7 + L.seed) > L.density) continue;
          fn(i * L.sx - ox + hash2(i, j + L.seed) * L.sx * 0.6, j * L.sy - oy + hash2(i + L.seed, j) * L.sy * 0.6, hash2(i + 31, j + L.seed * 3), i, j);
        }
      }
    };
    const sprite = (img, x, y, scale, alpha, rot = 0) => {
      const w = img.w * scale, h = img.h * scale;
      ctx.globalAlpha = alpha;
      if (rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.drawImage(img.c, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else ctx.drawImage(img.c, x - w / 2, y - h / 2, w, h);
    };

    // 1. haze: soft glows of color far behind everything
    grid({ f: 0.03, drift: 2, sx: 620, sy: 460, pad: 420, seed: 3, density: 0.45 }, (x, y, h) => sprite(A.haze[Math.floor(h * A.haze.length)], x, y, 3 + h * 2, 0.55));
    // 2. giant faint words looming in the distance
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    grid({ f: 0.06, drift: 3, sx: 460, sy: 260, pad: 300, seed: 5, density: 0.55 }, (x, y, h, i, j) => {
      ctx.globalAlpha = 0.05;
      ctx.font = `italic 700 ${Math.round(90 + h * 90)}px Georgia, serif`;
      ctx.fillStyle = '#d8ccff';
      ctx.fillText(ALL_WORDS[Math.floor(hash2(i, j + 77) * ALL_WORDS.length)], x, y);
    });
    // 3. a fabric of tiny words, tiled
    {
      const tile = A.fabric, f = 0.1;
      const ox = ((cam.x * f + t * 5) % tile.w + tile.w) % tile.w, oy = ((cam.y * f * 0.6) % tile.h + tile.h) % tile.h;
      ctx.globalAlpha = 0.13;
      for (let x = -ox; x < VW; x += tile.w) for (let y = -oy; y < VH; y += tile.h) ctx.drawImage(tile.c, x, y, tile.w, tile.h);
    }
    // 4. far clouds of words
    grid({ f: 0.15, drift: 6, sx: 280, sy: 190, pad: 220, seed: 9, density: 0.5 }, (x, y, h) => {
      sprite(A.clouds[Math.floor(h * A.clouds.length)], x, y + Math.sin(t * 0.3 + h * 9) * 6, 0.45 + h * 0.25, 0.24);
    });
    // 5. spirals and rings of words, slowly turning
    grid({ f: 0.22, drift: 4, sx: 560, sy: 360, pad: 260, seed: 11, density: 0.45 }, (x, y, h) => {
      const shapes = A.spirals.concat(A.rings);
      const img = shapes[Math.floor(h * shapes.length)];
      sprite(img, x, y, 0.6 + h * 0.5, 0.24, t * (h > 0.5 ? 0.06 : -0.05) + h * 6);
    });
    // 6. streams: long rivers of small words flowing across
    grid({ f: 0.28, drift: 14, sx: 760, sy: 150, pad: 400, seed: 13, density: 0.35 }, (x, y, h) => {
      sprite(A.streams[Math.floor(h * A.streams.length)], x, y, 0.8 + h * 0.4, 0.3);
    });
    // 7. nearer clouds of words
    grid({ f: 0.38, drift: 9, sx: 460, sy: 280, pad: 300, seed: 17, density: 0.38 }, (x, y, h) => {
      sprite(A.clouds[Math.floor(h * A.clouds.length)], x, y + Math.sin(t * 0.4 + h * 7) * 8, 0.85 + h * 0.4, 0.28);
    });
    // 8. loose words of every size
    ctx.textAlign = 'left';
    grid({ f: 0.5, drift: 5, sx: 190, sy: 100, pad: 120, seed: 19, density: 0.55 }, (x, y, h, i, j) => {
      ctx.globalAlpha = 0.07 + h * 0.07;
      ctx.font = `${h > 0.6 ? 'italic ' : ''}${Math.round(11 + h * 20)}px Georgia, serif`;
      ctx.fillStyle = '#cdc3ff';
      ctx.fillText(ALL_WORDS[Math.floor(hash2(i + 5, j) * ALL_WORDS.length)], x, y);
    });
    ctx.globalAlpha = 1;
  }

  // A faint layer of big drifting words and clouds in front of everything.
  drawForegroundWords(ctx, VW, VH) {
    const A = getArt();
    const f = 1.35, sx = 640, sy = 420;
    const ox = this.cam.x * f + this.time * 18, oy = this.cam.y * f * 0.6;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = Math.floor((ox - 300) / sx); i <= Math.ceil((ox + VW + 300) / sx); i++) {
      for (let j = Math.floor((oy - 300) / sy); j <= Math.ceil((oy + VH + 300) / sy); j++) {
        const h = hash2(i * 3 + 101, j * 5 + 7);
        if (h > 0.45) continue;
        const x = i * sx - ox + hash2(i, j + 40) * sx * 0.5, y = j * sy - oy + hash2(i + 40, j) * sy * 0.5;
        if (h < 0.2) {
          const img = A.clouds[Math.floor(hash2(i, j) * A.clouds.length)];
          ctx.globalAlpha = 0.1;
          ctx.drawImage(img.c, x - img.w * 0.9, y - img.h * 0.9, img.w * 1.8, img.h * 1.8);
        } else {
          ctx.globalAlpha = 0.07;
          ctx.font = `italic ${Math.round(60 + h * 60)}px Georgia, serif`;
          ctx.fillStyle = '#efe6ff';
          ctx.fillText(ALL_WORDS[Math.floor(hash2(i + 9, j) * ALL_WORDS.length)], x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawFigment(ctx) {
    const f = this.f, n = this.count;
    const a = this.bookCount(0), b = this.bookCount(1);
    const mix = a + b ? b / (a + b) : 0.5;
    const rgb = n ? BOOK_RGB[0].map((v, k) => Math.round(v + (BOOK_RGB[1][k] - v) * mix)) : [255, 248, 230];
    const R = 18 + n * 1.4;
    const blink = f.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.4 : 1;
    const gl = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, R * 2.1);
    gl.addColorStop(0, `rgba(${rgb},0.55)`);
    gl.addColorStop(0.45, `rgba(${rgb},0.18)`);
    gl.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(f.x, f.y, R * 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // the words it carries orbit it
    ctx.font = '600 11px Georgia, serif';
    this.carried.forEach((w, k) => {
      const ang = this.time * 1.1 + (k * Math.PI * 2) / this.carried.length;
      const rr = R + 10 + (k % 2) * 9;
      ctx.fillStyle = BOOK_COLORS[w.book];
      ctx.fillText(w.text, f.x + Math.cos(ang) * rr * 1.35, f.y + Math.sin(ang) * rr * 0.75);
    });
    const bob = Math.sin(this.time * 3) * 1.5;
    ctx.font = `italic 700 ${13 + n * 0.6}px Georgia, serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,12,40,0.6)';
    ctx.strokeText(this.label, f.x, f.y + bob);
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(this.label, f.x, f.y + bob);
    ctx.globalAlpha = 1;
  }

  drawBook(ctx) {
    const b = this.book, mid = b.x + b.w / 2;
    ctx.fillStyle = 'rgba(250,245,232,0.08)';
    ctx.beginPath(); ctx.ellipse(mid, b.y + b.h / 2, b.w * 0.7, b.h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 10); ctx.quadraticCurveTo(b.x + b.w / 4, b.y - 8, mid, b.y + 12);
    ctx.quadraticCurveTo(b.x + (b.w * 3) / 4, b.y - 8, b.x + b.w, b.y + 10);
    ctx.lineTo(b.x + b.w, b.y + b.h); ctx.quadraticCurveTo(b.x + (b.w * 3) / 4, b.y + b.h - 14, mid, b.y + b.h);
    ctx.quadraticCurveTo(b.x + b.w / 4, b.y + b.h - 14, b.x, b.y + b.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(mid - 1, b.y + 12, 2, b.h - 12);
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(70,58,46,0.75)';
    const vocab = WORDS[b.ch.key];
    for (let k = 0; k < 8; k++) {
      let line = '';
      for (let j = 0; j < 6; j++) line += vocab[(k * 5 + j * 3) % vocab.length] + ' ';
      ctx.fillText(line, b.x + 20, b.y + 26 + k * 14, b.w / 2 - 34);
      ctx.fillText(line, mid + 14, b.y + 26 + k * 14, b.w / 2 - 34);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff8e6';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(b.ch.num.toUpperCase(), mid, b.y - 34);
    ctx.font = '700 30px Georgia, serif';
    ctx.fillText(b.ch.title, mid, b.y - 6);
  }

  drawHud(ctx, VW) {
    const n = this.count;
    const x = 14, y = 12, w = 190;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'italic 700 15px Georgia, serif';
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(`${this.label}  ·  ${Math.min(n, MIND_GOAL)} / ${MIND_GOAL}`, x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y + 22, w, 6);
    const a = this.bookCount(0), b = this.bookCount(1);
    ctx.fillStyle = BOOK_COLORS[0];
    ctx.fillRect(x, y + 22, (w * Math.min(a, MIND_GOAL)) / MIND_GOAL, 6);
    ctx.fillStyle = BOOK_COLORS[1];
    ctx.fillRect(x + (w * Math.min(a, MIND_GOAL)) / MIND_GOAL, y + 22, (w * Math.min(b, MIND_GOAL - Math.min(a, MIND_GOAL))) / MIND_GOAL, 6);
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillStyle = BOOK_COLORS[0];
    ctx.fillText(`${this.books[0].title} ${a}`, x, y + 32);
    if (!this.single) {
      ctx.textAlign = 'right';
      ctx.fillStyle = BOOK_COLORS[1];
      ctx.fillText(`${b} ${this.books[1].title}`, x + w, y + 32);
    }
  }
}

// ---- pre-rendered word art for the Mind's background ------------------------------
// Each piece is drawn once into an offscreen canvas, then reused every frame.
let ART = null;
export function getArt() { return ART || (ART = buildArt()); }

function buildArt() {
  const S = Math.min(1.75, window.devicePixelRatio || 1);
  const rng = mulberry32(20231);
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
    const x = c.getContext('2d');
    x.scale(S, S);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    return { c, x, w, h };
  };
  const word = () => ALL_WORDS[Math.floor(rng() * ALL_WORDS.length)];
  // lavender, rose, slate and violet: amber and cyan are kept for the words you can collect
  const TINTS = ['232,224,255', '255,196,220', '190,205,240', '214,190,255'];

  // clouds: words packed into a lumpy cloud, big in the middle, small and faint at the edges
  const clouds = [];
  for (let k = 0; k < 8; k++) {
    const W = 340, H = 190, a = canvas(W, H), tint = TINTS[k % TINTS.length];
    const blobs = Array.from({ length: 4 + Math.floor(rng() * 3) }, (_, b) => ({
      x: W * (0.22 + (b / 6) * 0.56 + (rng() - 0.5) * 0.1), y: H * (0.5 + (rng() - 0.5) * 0.25), r: 45 + rng() * 40,
    }));
    for (let n = 0; n < 90; n++) {
      const x = 10 + rng() * (W - 20), y = 10 + rng() * (H - 20);
      let best = 0;
      for (const b of blobs) best = Math.max(best, 1 - Math.hypot(x - b.x, y - b.y) / b.r);
      if (best <= 0) continue;
      const size = 8 + best * 20 + rng() * 4;
      a.x.font = `${rng() < 0.4 ? 'italic ' : ''}${rng() < 0.3 ? 700 : 400} ${size.toFixed(1)}px Georgia, serif`;
      a.x.fillStyle = `rgba(${tint},${(0.25 + best * 0.7).toFixed(2)})`;
      a.x.save(); a.x.translate(x, y); a.x.rotate((rng() - 0.5) * 0.35);
      a.x.fillText(word(), 0, 0);
      a.x.restore();
    }
    clouds.push(a);
  }

  // spirals: words winding outward, growing as they go
  const spirals = [];
  for (let k = 0; k < 2; k++) {
    const W = 300, a = canvas(W, W), tint = TINTS[k ? 1 : 0];
    let th = 0.6;
    while (true) {
      const r = 10 + th * 11;
      if (r > W / 2 - 14) break;
      const size = 7 + th * 1.5;
      const w = word();
      a.x.font = `italic ${size.toFixed(1)}px Georgia, serif`;
      a.x.fillStyle = `rgba(${tint},${(0.9 - (r / (W / 2)) * 0.6).toFixed(2)})`;
      a.x.save(); a.x.translate(W / 2 + Math.cos(th) * r, W / 2 + Math.sin(th) * r); a.x.rotate(th + Math.PI / 2);
      a.x.fillText(w, 0, 0);
      a.x.restore();
      th += (a.x.measureText(w).width + 8) / r;
    }
    spirals.push(a);
  }

  // rings: words circling at two radii
  const rings = [];
  for (let k = 0; k < 2; k++) {
    const W = 300, a = canvas(W, W), tint = TINTS[k ? 3 : 2];
    for (const [r, size] of [[132, 14], [96, 11], [64, 9]]) {
      let th = rng() * 6.28, end = th + Math.PI * 2 - 0.2;
      a.x.font = `${size}px Georgia, serif`;
      while (th < end) {
        const w = word();
        a.x.fillStyle = `rgba(${tint},${(0.35 + rng() * 0.5).toFixed(2)})`;
        a.x.save(); a.x.translate(W / 2 + Math.cos(th) * r, W / 2 + Math.sin(th) * r); a.x.rotate(th + Math.PI / 2);
        a.x.fillText(w, 0, 0);
        a.x.restore();
        th += (a.x.measureText(w).width + 10) / r;
      }
    }
    rings.push(a);
  }

  // streams: a long wavy river of small words
  const streams = [];
  for (let k = 0; k < 3; k++) {
    const W = 760, H = 60, a = canvas(W, H), tint = TINTS[k];
    let x = 10;
    while (x < W - 40) {
      const w = word(), size = 9 + rng() * 6;
      a.x.font = `${rng() < 0.5 ? 'italic ' : ''}${size.toFixed(1)}px Georgia, serif`;
      a.x.textAlign = 'left';
      a.x.fillStyle = `rgba(${tint},${(0.35 + 0.55 * Math.sin((x / W) * Math.PI)).toFixed(2)})`;
      a.x.fillText(w, x, H / 2 + Math.sin(x * 0.018 + k) * 14);
      x += a.x.measureText(w).width + 7;
    }
    streams.push(a);
  }

  // fabric: a tile thick with tiny words
  const fabric = canvas(760, 340);
  for (let n = 0; n < 340; n++) {
    fabric.x.font = `${rng() < 0.3 ? 'italic ' : ''}${(6 + rng() * 5).toFixed(1)}px Georgia, serif`;
    fabric.x.textAlign = 'left';
    fabric.x.fillStyle = `rgba(210,200,255,${(0.2 + rng() * 0.6).toFixed(2)})`;
    const w = word();
    const tw = fabric.x.measureText(w).width;
    fabric.x.fillText(w, rng() * (760 - tw), 6 + rng() * 328);
  }

  // haze: soft colored glows
  const haze = ['120,80,220', '60,90,200', '170,80,150', '80,110,190'].map((rgb) => {
    const a = canvas(128, 128);
    const g = a.x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},0.35)`);
    g.addColorStop(0.5, `rgba(${rgb},0.12)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    a.x.fillStyle = g;
    a.x.fillRect(0, 0, 128, 128);
    return a;
  });

  return { clouds, spirals, rings, streams, fabric, haze };
}

// The Mind's layered word backdrop, for other modes that happen inside the mind (the Deep Mind).
// `holder` keeps the low-resolution canvas between frames.
export function renderBackdrop(ctx, VW, VH, cam, time, holder) {
  const bw = Math.ceil(VW * BG_RES), bh = Math.ceil(VH * BG_RES);
  if (!holder.mindBg || holder.mindBg.width !== bw || holder.mindBg.height !== bh) {
    holder.mindBg = document.createElement('canvas');
    holder.mindBg.width = bw; holder.mindBg.height = bh;
  }
  const b = holder.mindBg.getContext('2d');
  b.setTransform(BG_RES, 0, 0, BG_RES, 0, 0);
  const g = b.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#1b1531');
  g.addColorStop(1, '#07060e');
  b.fillStyle = g;
  b.fillRect(0, 0, VW, VH);
  Mind.prototype.drawBackgroundWords.call({ cam, time }, b, VW, VH);
  b.globalAlpha = 1;
  b.fillStyle = 'rgba(7,6,14,0.35)';
  b.fillRect(0, 0, VW, VH);
  ctx.drawImage(holder.mindBg, 0, 0, VW, VH);
}

// The regular world dissolving into words as you fall out of the story.
export function drawWordRain(ctx, VW, VH, amount, time) {
  if (amount <= 0) return;
  ctx.fillStyle = `rgba(7,6,14,${Math.min(1, amount)})`;
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 16px Georgia, serif';
  const n = Math.floor(60 * Math.min(1, amount * 1.4));
  for (let i = 0; i < n; i++) {
    const x = hash2(i, 91) * VW;
    const y = ((hash2(i, 92) * VH + time * (180 + hash2(i, 93) * 200)) % (VH + 40)) - 20;
    ctx.fillStyle = `rgba(236,228,207,${0.25 + 0.5 * hash2(i, 94)})`;
    ctx.fillText(ALL_WORDS[Math.floor(hash2(i, 95) * ALL_WORDS.length)], x, y);
  }
}
