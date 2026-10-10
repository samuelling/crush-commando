// Tile grid + procedural chunk generator. Chunks are chosen per chapter of the book.
import { clamp, mulberry32, randInt } from './util.js';
import { CHAPTERS, LAST_CHAPTER, SKINS, chapterIndexAt } from './chapters.js';

export const T = 48;            // tile size in world px
export const ROWS = 14;         // world height in tiles
export const SOLID = 1;
export const SPIKE = 2;
export const CRACK = 3;         // solid until the tiger gets to it
export const LEVEL_BOTTOM = ROWS * T;
export const REGION_RULES = ['moon', 'sunday', 'small', 'wind'];

const MIN_ROW = 5;   // highest allowed ground surface row
const MAX_ROW = 11;  // lowest allowed ground surface row
const key = (cx, cy) => cx * 16 + cy;

export class Level {
  constructor(seed = 1, startChapter = 0) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.tiles = new Map();
    this.spawns = [];
    this.colSkin = [];
    this.regions = [];
    this.gates = [];
    this.groundRow = 10;
    this.chunkCount = 0;
    this.chunksInChapter = 0;
    this.sinceCheckpoint = 0;
    this.sinceHeart = 4;
    this.lastType = '';
    this.lastRule = '';
    this.billboardN = 0;
    this.vaseChapters = new Set();
    this.startChapter = startChapter;
    this.gated = Math.max(0, startChapter - 1);
    // Continuing a chapter starts a short run-up before that chapter's gate.
    this.startCol = startChapter > 0 ? CHAPTERS[startChapter].start - 11 : 0;
    this._buildStart();
  }

  get(cx, cy) {
    if (cx < this.startCol) return SOLID;
    if (cy < 0 || cy >= ROWS) return 0;
    return this.tiles.get(key(cx, cy)) || 0;
  }
  isSolid(cx, cy) { const t = this.get(cx, cy); return t === SOLID || t === CRACK; }
  solidAt(x, y) { return this.isSolid(Math.floor(x / T), Math.floor(y / T)); }
  set(cx, cy, v) { if (cy >= 0 && cy < ROWS) this.tiles.set(key(cx, cy), v); }
  skinAt(cx) { return this.colSkin[cx] || 'grass'; }
  ruleAt(cx) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (cx >= r.c0 && cx <= r.c1) return r.rule;
    }
    return null;
  }

  fillGround(c0, c1, row) {
    for (let c = c0; c <= c1; c++) for (let r = row; r < ROWS; r++) this.set(c, r, SOLID);
  }
  spawn(obj) { this.spawns.push(obj); }
  coin(cx, cy) { this.spawn({ type: 'coin', x: cx * T + T / 2, y: cy * T + T / 2 }); }
  coinLine(c0, c1, row) { for (let c = c0; c <= c1; c++) this.coin(c, row); }
  coinArc(c0, c1, row, height) {
    const n = c1 - c0;
    for (let c = c0; c <= c1; c++) {
      const t = n ? (c - c0) / n : 0.5;
      this.coin(c, row - Math.round(Math.sin(t * Math.PI) * height));
    }
  }

  ensure(col) { while (this.genCol < col) this._genChunk(); }

  _buildStart() {
    const s = this.startCol;
    this.fillGround(s, s + 13, 10);
    this.coinLine(s + 7, s + 10, 8);
    this.genCol = s + 14;
    const skin = CHAPTERS[chapterIndexAt(s)].skin;
    for (let c = s; c < this.genCol; c++) this.colSkin[c] = skin === 'collage' ? 'grass' : skin;
  }

  _pick(pool) {
    const entries = Object.entries(pool);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let type = entries[0][0];
    for (let tries = 0; tries < 4; tries++) {
      let r = this.rng() * total;
      for (const [k, w] of entries) { r -= w; if (r < 0) { type = k; break; } }
      if (type !== this.lastType || this.rng() < 0.25) break;
    }
    return type;
  }

  _genChunk() {
    const c0 = this.genCol;
    const meter = c0 - 3;
    const ci = chapterIndexAt(meter);
    const ch = CHAPTERS[ci];
    const r = this.rng;
    this.riseCap = ch.riseCap ?? 2;
    this.gapCap = ch.gapCap ?? 6;
    const d = Math.min(1, Math.max(0, meter) / 900) * (ch.diffScale ?? 1);
    this.chunkCount++;
    this.chunksInChapter++;
    this.sinceCheckpoint++;
    this.sinceHeart++;
    let type;
    if (ci > this.gated) type = 'gate';
    else if (this.sinceCheckpoint >= 8) type = 'checkpoint';
    else if (this.chunkCount <= 2) type = this.chunkCount === 1 ? 'gap' : 'flat';
    else if (ch.key === 'dream' && !this.doorPlaced && this.chunksInChapter >= 7) type = 'mindDoor';
    else if (ch.key === 'gray' && !this.vaseChapters.has(ci) && this.chunksInChapter >= 4 && r() < 0.4) type = 'vase';
    else type = this._pick(ch.pool);
    this.lastType = type;
    this['_' + type](d, ch, ci);
    const skin = ch.skin === 'collage' ? SKINS[randInt(r, 0, SKINS.length - 1)] : ch.skin;
    for (let c = c0; c < this.genCol; c++) this.colSkin[c] = skin;
  }

  // ---- chunk types --------------------------------------------------------
  _flat(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 4, 8);
    this.fillGround(c, c + len - 1, this.groundRow);
    if (len >= 5 && r() < 0.65) {
      if (r() < 0.5) this.coinLine(c + 1, c + len - 2, this.groundRow - 2);
      else this.coinArc(c + 1, c + len - 2, this.groundRow - 2, 2);
    }
    this.genCol = c + len;
  }

  _gap(d) {
    const r = this.rng, c = this.genCol;
    const maxW = 2 + Math.floor(d * 3) + (r() < 0.3 ? 1 : 0);
    const w = randInt(r, 2, Math.min(this.gapCap, Math.max(2, maxW)));
    let delta = randInt(r, -this.riseCap, 1);
    if ((w >= 3 || this.chunkCount < 6) && delta < -1) delta = -1;
    if (w >= 6) delta = Math.max(delta, 0);
    const newRow = clamp(this.groundRow + delta, MIN_ROW, MAX_ROW);
    this.coinArc(c, c + w - 1, Math.min(this.groundRow, newRow) - 2, 2);
    this.groundRow = newRow;
    const land = randInt(r, 3, 6);
    this.fillGround(c + w, c + w + land - 1, this.groundRow);
    this.genCol = c + w + land;
  }

  _platforms(d) {
    const r = this.rng;
    const lead = randInt(r, 2, 3);
    let c = this.genCol + lead;
    let p = clamp(this.groundRow - randInt(r, 0, Math.min(this.riseCap, lead === 2 ? 2 : 1)), 3, MAX_ROW);
    const n = randInt(r, 2, 3 + Math.floor(d * 2));
    let lastEnd = c;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const g = randInt(r, 2, 3);
        c = lastEnd + g;
        p = clamp(p + randInt(r, -Math.min(this.riseCap, g === 2 ? 2 : 1), 1), 3, MAX_ROW);
      }
      const w = randInt(r, 2, 3);
      for (let k = 0; k < w; k++) this.set(c + k, p, SOLID);
      if (r() < 0.7) this.coinLine(c, c + w - 1, p - 2);
      if (d > 0.45 && w === 3 && r() < 0.35) this.spawn({ type: 'walker', x: (c + 1.5) * T, y: p * T, dir: 1 });
      lastEnd = c + w;
    }
    c = lastEnd + randInt(r, 2, 3);
    this.groundRow = clamp(p + randInt(r, 0, 2), MIN_ROW, MAX_ROW);
    const land = randInt(r, 3, 6);
    this.fillGround(c, c + land - 1, this.groundRow);
    this.genCol = c + land;
  }

  _spikes(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 7, 10);
    this.fillGround(c, c + len - 1, this.groundRow);
    let x = c + 2;
    while (x <= c + len - 4) {
      const w = r() < 0.3 + d * 0.4 ? 2 : 1;
      for (let k = 0; k < w; k++) this.set(x + k, this.groundRow - 1, SPIKE);
      this.coin(x + (w === 2 ? 1 : 0), this.groundRow - 3);
      if (w === 2) this.coin(x, this.groundRow - 3);
      x += w + randInt(r, 3, 4);
    }
    this.genCol = c + len;
  }

  _stairs(d) {
    const r = this.rng;
    let x = this.genCol, row = this.groundRow;
    const canUp = row - 3 >= MIN_ROW;
    const canDown = row + 3 <= MAX_ROW;
    const up = canUp && (!canDown || r() < 0.6);
    for (let s = 0; s < 3; s++) {
      row += up ? -1 : 1;
      this.fillGround(x, x + 1, row);
      if (up && s < 2) this.coin(x + 1, row - 2);
      x += 2;
    }
    this.fillGround(x, x + 3, row);
    if (!up) this.coinLine(x, x + 2, row - 2);
    this.groundRow = row;
    this.genCol = x + 4;
  }

  _walkers(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 7, 10);
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'walker', x: (c + 3.5) * T, y: this.groundRow * T, dir: 1 });
    if (d > 0.5 && r() < 0.5) this.spawn({ type: 'walker', x: (c + len - 2.5) * T, y: this.groundRow * T, dir: -1 });
    if (r() < 0.5) this.coinLine(c + 2, c + len - 3, this.groundRow - 3);
    this.genCol = c + len;
  }

  _mover(d) {
    const r = this.rng, c = this.genCol;
    const L = randInt(r, 7, 9);
    const w = 3 * T;
    this.spawn({
      type: 'mover', x0: (c + 0.5) * T, x1: (c + L - 0.5) * T - w, y: this.groundRow * T, w, h: 22,
      period: 3 + L * 0.2, phase: r() * Math.PI * 2,
    });
    this.coinArc(c + 2, c + L - 3, this.groundRow - 3, 1);
    this.groundRow = clamp(this.groundRow + randInt(r, -1, 1), MIN_ROW, MAX_ROW);
    const land = randInt(r, 3, 6);
    this.fillGround(c + L, c + L + land - 1, this.groundRow);
    this.genCol = c + L + land;
  }

  _bats(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 8, 10);
    this.fillGround(c, c + len - 1, this.groundRow);
    const n = 1 + (d > 0.6 && r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.spawn({
        type: 'bat', x: (c + 3 + i * 4) * T, y: (this.groundRow - 3) * T,
        ax: 1.5 * T, ay: 0.7 * T, period: 2.2 + r(), phase: r() * Math.PI * 2,
      });
    }
    for (let x = c + 1; x <= c + len - 2; x += 2) this.coin(x, this.groundRow - 1);
    this.genCol = c + len;
  }

  _checkpoint(d, ch) {
    const c = this.genCol;
    const ledge = this.groundRow - (ch.noDouble ? 2 : 3);
    const len = 7;
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'checkpoint', x: (c + 2) * T + T / 2, y: this.groundRow * T });
    this.sinceCheckpoint = 0;
    if (this.sinceHeart >= 9) {
      this.set(c + 5, ledge, SOLID);
      this.set(c + 6, ledge, SOLID);
      this.spawn({ type: 'heart', x: (c + 6) * T, y: ledge * T - 22 });
      this.sinceHeart = 0;
    }
    this.genCol = c + len;
  }

  // A chapter gate: a long safe stretch with a bookmark flag where the chapter begins.
  _gate(d, ch, ci) {
    const c = this.genCol;
    // The last gate is the ending: a long, quiet road with nothing to dodge while the end card shows.
    const len = ci === LAST_CHAPTER ? 56 : 10;
    this.fillGround(c, c + len - 1, this.groundRow);
    if (ci === LAST_CHAPTER) for (let k = c + 8; k < c + len - 6; k += 9) this.coinArc(k, k + 4, this.groundRow - 2, 2);
    const fx = (c + 2) * T + T / 2;
    this.spawn({ type: 'checkpoint', x: fx, y: this.groundRow * T, gate: ci });
    this.gates.push({ ci, col: c + 2, x: fx });
    if (ch.key === 'flight') this.spawn({ type: 'ring', x: (c + 5) * T + T / 2, y: this.groundRow * T - 34 });
    const last = this.regions[this.regions.length - 1];
    if (last) last.c1 = Math.min(last.c1, c - 1);
    this.sinceCheckpoint = 0;
    this.chunksInChapter = 0;
    this.gated = ci;
    this.genCol = c + len;
  }

  // Stoop ball: a bouncing pink ball. Coins up high are only reachable by bouncing on it.
  _ball(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 8, 10);
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'ball', x: (c + 4) * T + T / 2, y: this.groundRow * T, range: 1.2 * T, phase: r() * 6.28 });
    this.coinLine(c + 3, c + 6, this.groundRow - 7);
    this.genCol = c + len;
  }

  // Dreamed country: a roadside sign announces the rule for the stretch after it.
  _sign(d) {
    const r = this.rng, c = this.genCol;
    const len = 6;
    this.fillGround(c, c + len - 1, this.groundRow);
    let rule;
    do { rule = REGION_RULES[randInt(r, 0, REGION_RULES.length - 1)]; } while (rule === this.lastRule);
    this.lastRule = rule;
    this.spawn({ type: 'sign', x: (c + 1) * T, y: this.groundRow * T, rule });
    const last = this.regions[this.regions.length - 1];
    if (last) last.c1 = Math.min(last.c1, c + 3);
    this.regions.push({ c0: c + 4, c1: c + 4 + 28, rule });
    this.genCol = c + len;
  }

  // The Lack: a drifting void over a long flat stretch.
  _lack(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 11, 13);
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({
      type: 'void', x: (c + len / 2) * T, y: (this.groundRow - 1.6) * T,
      ax: (len / 2 - 2.5) * T, ay: 0.8 * T, period: 7 + r() * 2, phase: r() * Math.PI * 2,
    });
    for (let k = 0; k < 4; k++) this.coin(c + 2 + k * 2 + (len > 11 ? 1 : 0), this.groundRow - 2);
    if (r() < 0.5 + d * 0.3) this.spawn({ type: 'walker', x: (c + 2.5) * T, y: this.groundRow * T, dir: 1 });
    this.genCol = c + len;
  }

  // The Gray: cracked street that the tiger collapses, behind you or just ahead.
  _collapse(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 11, 13);
    this.fillGround(c, c + len - 1, this.groundRow);
    let x = c + 2;
    const segs = 1 + (d > 0.5 && r() < 0.6 ? 1 : 0);
    for (let s = 0; s < segs && x + 2 <= c + len - 3; s++) {
      const w = d > 0.6 && r() < 0.4 ? 3 : 2;
      if (x + w - 1 > c + len - 3) break;
      for (let k = 0; k < w; k++) this.set(x + k, this.groundRow, CRACK);
      this.spawn({ type: 'crack', c0: x, c1: x + w - 1, row: this.groundRow, mode: r() < 0.5 ? 'behind' : 'ahead' });
      this.coinArc(x - 1, x + w, this.groundRow - 2, 1);
      x += w + randInt(r, 3, 4);
    }
    this.genCol = c + len;
  }

  _billboard(d) {
    const r = this.rng, c = this.genCol;
    const len = randInt(r, 7, 9);
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'billboard', x: (c + 1) * T, y: this.groundRow * T, idx: this.billboardN++ });
    if (r() < 0.6) this.spawn({ type: 'walker', x: (c + len - 2.5) * T, y: this.groundRow * T, dir: -1 });
    this.genCol = c + len;
  }

  // Dreamed Country's door: a checkpoint and a door standing alone in a field, into the mind.
  _mindDoor(d) {
    const c = this.genCol;
    const len = 12;
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'checkpoint', x: (c + 2) * T + T / 2, y: this.groundRow * T });
    this.spawn({ type: 'mindDoor', x: (c + 7) * T, y: this.groundRow * T });
    const last = this.regions[this.regions.length - 1];
    if (last) last.c1 = Math.min(last.c1, c - 1);
    this.sinceCheckpoint = 0;
    this.doorPlaced = true;
    this.genCol = c + len;
  }

  _vase(d, ch, ci) {
    const c = this.genCol;
    const len = 7;
    this.fillGround(c, c + len - 1, this.groundRow);
    this.spawn({ type: 'vase', x: (c + 4) * T, y: (this.groundRow - 2) * T });
    this.vaseChapters.add(ci);
    this.genCol = c + len;
  }
}
