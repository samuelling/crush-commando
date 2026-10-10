// Game state machine, player physics, entities, camera, and the book's chapter logic.
import { clamp, lerp, smoothstep } from './util.js';
import { T, ROWS, SPIKE, LEVEL_BOTTOM, Level } from './level.js';
import { CHAPTERS, LAST_CHAPTER } from './chapters.js';
import { SIGN_TEXT, HEADLINES, readPref, writePref } from './story.js';
import * as R from './render.js';
import { Mind, drawWordRain, renderBackdrop } from './mind.js';
import { Crawl } from './crawl.js';

const GRAVITY = 2300;
const MAX_FALL = 1150;
const PL = {
  w: 30, h: 42, accel: 2600, airAccel: 1800, friction: 3000, maxSpeed: 290,
  jumpVel: -720, djumpVel: -660, coyote: 0.09, buffer: 0.12,
};
const FLIGHT_MAX = 1.4;
const KARMA_FALL = 50;
export const MAX_HEARTS = 3;
const TASTES = ['coins', 'enemies', 'still', 'rising'];
const WALKER_STYLE = { grass: 'blob', street: 'hat', brownstone: 'cap', dream: 'dream', salt: 'shadow', gray: 'hat', plain: 'plain' };
const BIRD_STYLE = { street: 'pigeon', brownstone: 'pigeon', gray: 'pigeon', plain: 'pigeon' };
const PLATFORM_STYLE = { dream: 'cloud', street: 'steel', brownstone: 'steel', gray: 'steel' };
const COMIC_WORDS = ['BOP!', 'POW!', 'THWACK!', 'BONK!', 'ZAP!'];
const LINES_FALLBACK = { end: 'You came up out of the mind into the salt flats.', wake: 'You woke up next to the door.' };
const NUMERALS = ['P', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'E'];

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

class Player {
  constructor(cx, bottom) {
    this.w = PL.w; this.h = PL.h; this.scale = 1;
    this.x = cx - this.w / 2; this.y = bottom - this.h;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyoteT = 0; this.bufferT = 0;
    this.canDouble = true; this.jumpCut = true;
    this.sx = 1; this.sy = 1; this.spin = 0; this.runPhase = 0;
    this.invuln = 0;
    this.dead = false;
    this.standingOn = null;
    this.trail = [];
    this.ring = null;          // null | 'flight' | 'invisible'
    this.flight = FLIGHT_MAX;
    this.flying = false;
  }
  get cx() { return this.x + this.w / 2; }
  get bottom() { return this.y + this.h; }
}

export class Game {
  constructor(input, sound, ui, story) {
    this.input = input; this.sound = sound; this.ui = ui; this.story = story;
    this.VW = 800; this.VH = 450;
    this.time = 0;
    this.best = +readPref('hd_best', '0') || 0;
    this.state = 'title';
    this.newGame(0);
  }

  setView(VW, VH) { this.VW = VW; this.VH = VH; }

  newGame(startChapter = 0) {
    const seed = (Math.random() * 1e9) | 0;
    this.startChapter = startChapter;
    this.level = new Level(seed, startChapter);
    const s = this.level.startCol;
    this.player = new Player((s + 3) * T + T / 2, 10 * T);
    this.coins = []; this.enemies = []; this.platforms = []; this.items = []; this.flags = [];
    this.balls = []; this.voids = []; this.cracks = []; this.signs = []; this.billboards = []; this.glimpses = []; this.doors = [];
    this.particles = []; this.texts = [];
    this.hearts = MAX_HEARTS; this.coinCount = 0; this.kills = 0; this.bonus = 0; this.karmaDock = 0; this.pendingDock = false;
    this.startMeter = s; this.meter = s; this.distance = 0; this.score = 0;
    this.chapterIdx = Math.max(0, startChapter - 1);
    this.lackTaste = TASTES[Math.floor(Math.random() * TASTES.length)];
    this.checkpoint = { x: this.player.cx, y: 10 * T };
    this.cam = { x: s * T, y: LEVEL_BOTTOM + 64 - this.VH };
    this.shake = 0; this.fade = 0; this.stateT = 0; this.respawned = false;
    this.worldTime = 0; this.bgTime = 0; this.frozen = false;
    this.rule = null;
    this.arrest = { thin: false, hud: false, silence: false, ending: false };
    this.mind = null; this.mindVisits = 0; this.distanceBank = 0; this.flash = 0; this.layersKey = null;
    this.crawl = null; this.crawlMusic = null;
    this.sync();
    this.ui.hearts(this.hearts);
    this.ui.coins(0);
    this.ui.score(0);
    this.ui.scoreLabel(this.chapterIdx >= 1 ? 'KARMA' : '');
    this.ui.arrestHud(false);
    this.story.reset(this.chapterIdx);
    this.sound.setArrangement(CHAPTERS[startChapter].music);
    this.sound.setLayers({});
  }

  start(chapter = 0) {
    if (this.state !== 'title') return;
    this.newGame(chapter);
    this.state = 'playing';
    this.input.reset();
    this.sound.play('start');
    this.sound.startMusic();
  }
  pause() { if (['playing', 'respawn', 'mind', 'dying', 'crawl'].includes(this.state)) { this.prevState = this.state; this.state = 'paused'; this.ui.show('pause'); } }
  resume() { if (this.state === 'paused') { this.state = this.prevState || 'playing'; this.input.reset(); this.ui.show(null); } }
  togglePause() { this.state === 'paused' ? this.resume() : this.pause(); }

  get chapter() { return CHAPTERS[this.chapterIdx]; }

  // Pull generated spawns from the level into live entities.
  sync() {
    const lv = this.level;
    lv.ensure(Math.ceil((this.cam.x + this.VW) / T) + 40);
    for (const s of lv.spawns) {
      const skin = lv.skinAt(Math.floor((s.x0 ?? s.x) / T));
      switch (s.type) {
        case 'coin': this.coins.push({ x: s.x, y: s.y, w: 22, h: 22 }); break;
        case 'walker': this.enemies.push({ type: 'walker', style: WALKER_STYLE[skin] || 'blob', x: s.x - 20, y: s.y - 30, w: 40, h: 30, vx: 60 * s.dir, vy: 0, dir: s.dir, anim: Math.random() * 6, dead: false }); break;
        case 'bat': this.enemies.push({ type: 'bat', style: BIRD_STYLE[skin] || 'bat', x0: s.x, y0: s.y, x: s.x, y: s.y, w: 30, h: 22, ax: s.ax, ay: s.ay, period: s.period, phase: s.phase, face: 1, dead: false }); break;
        case 'mover': this.platforms.push({ x: s.x0, y: s.y, w: s.w, h: s.h, x0: s.x0, x1: s.x1, period: s.period, phase: s.phase, dx: 0, dy: 0, style: PLATFORM_STYLE[skin] || 'wood' }); break;
        case 'heart': this.items.push({ type: 'heart', x: s.x - 14, y: s.y - 13, w: 28, h: 26 }); break;
        case 'ring': this.items.push({ type: 'ring', x: s.x - 12, y: s.y - 12, w: 24, h: 24 }); break;
        case 'vase': this.items.push({ type: 'vase', x: s.x - 14, y: s.y - 18, w: 28, h: 36 }); break;
        case 'checkpoint': this.flags.push({ x: s.x, y: s.y, active: false, gate: s.gate ?? null, label: s.gate != null ? NUMERALS[s.gate] : '' }); break;
        case 'ball': this.balls.push({ x0: s.x, x: s.x, base: s.y, r: 14, h: 0, vh: 0, range: s.range, phase: s.phase, sq: 1, w: 28 }); break;
        case 'void': this.voids.push({ x0: s.x, y0: s.y, x: s.x, y: s.y, ax: s.ax, ay: s.ay, period: s.period, phase: s.phase, r: 30 }); break;
        case 'crack': this.cracks.push({ c0: s.c0, c1: s.c1, row: s.row, mode: s.mode, state: 'idle', t: 0, x: s.c0 * T, w: (s.c1 - s.c0 + 1) * T }); break;
        case 'sign': this.signs.push({ x: s.x, y: s.y, rule: s.rule, w: 4 * T }); break;
        case 'billboard': this.billboards.push({ x: s.x, y: s.y, idx: s.idx, w: 5 * T }); break;
        case 'mindDoor': this.doors.push({ x: s.x, y: s.y, w: 5 * T, used: false }); break;
      }
    }
    lv.spawns.length = 0;
    const lim = this.cam.x - 700;
    const keep = (e) => e.x + (e.w || 0) > lim;
    this.coins = this.coins.filter(keep);
    this.enemies = this.enemies.filter(keep);
    this.platforms = this.platforms.filter((p) => p.x1 + p.w > lim);
    this.items = this.items.filter(keep);
    this.flags = this.flags.filter((f) => f.x + 60 > lim);
    this.balls = this.balls.filter((b) => b.x0 + b.range + 20 > lim);
    this.voids = this.voids.filter((v) => v.x0 + v.ax + 60 > lim);
    this.cracks = this.cracks.filter(keep);
    this.signs = this.signs.filter(keep);
    this.billboards = this.billboards.filter(keep);
    this.doors = this.doors.filter(keep);
  }

  // ---- collision ----------------------------------------------------------
  moveX(b, dx) {
    if (dx === 0) return false;
    b.x += dx;
    const dir = dx > 0 ? 1 : -1;
    let hit = false;
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    const col = dir > 0 ? Math.floor((b.x + b.w - 0.01) / T) : Math.floor(b.x / T);
    for (let cy = y0; cy <= y1; cy++) {
      if (this.level.isSolid(col, cy)) {
        hit = true;
        b.x = dir > 0 ? col * T - b.w : (col + 1) * T;
        break;
      }
    }
    for (const p of this.platforms) {
      if (overlaps(b, p)) { hit = true; b.x = dir > 0 ? p.x - b.w : p.x + p.w; }
    }
    return hit;
  }

  moveY(b, dy) {
    if (dy === 0) return null;
    b.y += dy;
    const dir = dy > 0 ? 1 : -1;
    let res = null;
    const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
    const row = dir > 0 ? Math.floor((b.y + b.h - 0.01) / T) : Math.floor(b.y / T);
    for (let cx = x0; cx <= x1; cx++) {
      if (this.level.isSolid(cx, row)) {
        res = dir > 0 ? 'floor' : 'ceiling';
        b.y = dir > 0 ? row * T - b.h : (row + 1) * T;
        break;
      }
    }
    for (const p of this.platforms) {
      if (overlaps(b, p)) {
        if (dir > 0) { res = 'floor'; b.y = p.y - b.h; b.standingOn = p; }
        else { res = 'ceiling'; b.y = p.y + p.h; }
      }
    }
    return res;
  }

  rectBlocked(r) {
    const x0 = Math.floor(r.x / T), x1 = Math.floor((r.x + r.w - 0.01) / T);
    const y0 = Math.floor(r.y / T), y1 = Math.floor((r.y + r.h - 0.01) / T);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) if (this.level.isSolid(cx, cy)) return true;
    return this.platforms.some((p) => overlaps(r, p));
  }

  // ---- update -------------------------------------------------------------
  step(dt) {
    this.time += dt;
    if (!this.frozen) this.bgTime += dt;
    if (this.state === 'paused') return;
    this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.state === 'mind') {
      this.mind.step(dt, this.VW, this.VH);
      this.story.update(dt);
      if (this.mind.result) this.exitMind(this.mind.result);
      return;
    }
    if (this.state === 'crawl') {
      const nav = this.input.consumeNav();
      if (nav) this.ui.crawlNav(nav);
      if (this.input.consumeJump()) this.ui.crawlActivate();
      if (this.crawl.music !== this.crawlMusic) { this.crawlMusic = this.crawl.music; this.sound.setArrangement(this.crawlMusic); }
      if (this.crawl.result) this.exitCrawl(this.crawl.result);
      return;
    }
    this.updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.state === 'title') { this.cam.x += dt * 20; this.sync(); return; }
    this.stateT += dt;
    this.story.update(dt);

    if (this.state === 'respawn') {
      const t = this.stateT;
      this.fade = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.45);
      if (t >= 0.45 && !this.respawned) { this.respawned = true; this.doRespawn(); }
      if (t >= 0.9) { this.fade = 0; this.state = 'playing'; this.input.reset(); }
      return;
    }

    if (this.state === 'dying') {
      const p = this.player;
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += dt * 9;
      if (this.stateT > 1.6) this.enterMind();
      return;
    }

    // playing
    const p = this.player;
    const rule = this.level.ruleAt(Math.floor(p.cx / T));
    if (rule !== this.rule) {
      this.rule = rule;
      if (rule) this.story.special(rule);
    }
    const sdt = rule === 'sunday' ? dt * 0.6 : dt;
    this.worldTime += sdt;
    for (const pl of this.platforms) {
      const w = (Math.PI * 2) / pl.period;
      const nx = lerp(pl.x0, pl.x1, 0.5 + 0.5 * Math.sin(this.worldTime * w + pl.phase));
      pl.dx = nx - pl.x; pl.dy = 0; pl.x = nx;
    }
    this.updatePlayer(sdt, rule);
    this.updateEnemies(sdt);
    this.updateBalls(sdt);
    this.updateVoids(sdt);
    this.updateCracks(sdt);
    if (this.state !== 'playing') return;
    this.interactions(sdt);
    if (this.state !== 'playing') return;
    this.updateCamera(dt);
    this.sync();

    this.meter = p.x / T - 3;
    this.distance = Math.max(this.distance, this.meter - this.startMeter);
    this.score = Math.max(0, Math.floor(this.distanceBank + this.distance) + this.coinCount * 10 + this.kills * 25 + this.bonus - this.karmaDock);
    this.ui.score(this.score);
    this.chapterBeats();
  }

  // Story beats that happen partway through a chapter.
  chapterBeats() {
    const p = this.player, ch = this.chapter, prog = this.meter - ch.start;
    if (ch.key === 'flight' && p.ring === 'flight' && prog >= 100) {
      p.ring = 'invisible';
      p.flying = false;
      this.story.phase2 = true;
      this.story.special('turn');
      this.sound.setArrangement('hush');
      this.burst(p.cx, p.y + p.h / 2, 24, '#bfe6ff', 160, 0.8, 5, 0, 0);
    }
    if (ch.key === 'stoop' && !this.story.used.has('special:2:ball')) {
      if (this.balls.some((b) => b.x > this.cam.x + 40 && b.x < this.cam.x + this.VW - 40)) this.story.special('ball');
    }
    if (ch.key === 'arrest') {
      const a = this.arrest;
      // the music thins out with distance: everything, then no drums, then one voice, then nothing
      const key = prog < 25 ? 'all' : prog < 85 ? 'thin' : prog < 120 ? 'one' : 'none';
      if (key !== this.layersKey) {
        this.layersKey = key;
        this.sound.setLayers({ all: {}, thin: { perc: false }, one: { perc: false, bass: false }, none: { perc: false, bass: false, lead: false } }[key]);
      }
      if (!a.thin && prog >= 25) { a.thin = true; this.story.special('thin'); }
      if (!a.hud && prog >= 55) { a.hud = true; this.ui.arrestHud(true); this.story.special('hud'); }
      if (!a.silence && prog >= 120) { a.silence = true; this.story.special('silence'); }
      if (!a.ending && prog >= 175) { a.ending = true; this.story.special('ending'); }
    } else if (this.layersKey) {
      this.layersKey = null;
      this.sound.setLayers({});
    }
  }

  enterChapter(k) {
    if (k <= this.chapterIdx) return;
    const prev = this.chapterIdx;
    this.chapterIdx = k;
    const ch = CHAPTERS[k], p = this.player;
    this.hearts = MAX_HEARTS;
    this.ui.hearts(this.hearts);
    if (k > (+readPref('hd_bookmark', '0') || 0)) writePref('hd_bookmark', String(k));
    this.ui.scoreLabel('KARMA');
    this.sound.setArrangement(ch.music);
    this.sound.setLayers({});
    this.sound.play('chapter');
    if (ch.key === 'dream') p.ring = null;
    if (k === LAST_CHAPTER) {
      this.ui.arrestHud(false);
      writePref('hd_finished', '1');
    }
    this.story.enterChapter(k, prev, { taste: this.lackTaste });
  }

  updatePlayer(dt, rule) {
    const p = this.player, inp = this.input, ch = this.chapter;
    const dir = inp.dir;
    p.invuln = Math.max(0, p.invuln - dt);

    // dreamed rules: shrink or grow back (only when there is room)
    const target = rule === 'small' ? 0.65 : 1;
    if (p.scale !== target) {
      const nw = PL.w * target, nh = PL.h * target;
      const cand = { x: p.cx - nw / 2, y: p.bottom - nh, w: nw, h: nh };
      if (target < p.scale || !this.rectBlocked(cand)) {
        p.scale = target; p.w = nw; p.h = nh; p.x = cand.x; p.y = cand.y;
        this.burst(p.cx, p.y + p.h / 2, 10, '#9dffb0', 90, 0.4, 4, 0, 0);
      }
    }
    const grav = rule === 'moon' ? 0.5 : 1;
    const maxSpeed = rule === 'wind' ? 380 : PL.maxSpeed;
    if (ch.noDouble) p.canDouble = false;

    if (p.grounded) p.coyoteT = PL.coyote; else p.coyoteT -= dt;
    if (inp.consumeJump()) p.bufferT = PL.buffer; else p.bufferT -= dt;

    const accel = (p.grounded ? PL.accel : PL.airAccel) + (rule === 'wind' && dir >= 0 ? 500 : 0);
    if (dir !== 0) {
      p.facing = dir;
      if (Math.sign(p.vx) !== dir || Math.abs(p.vx) < maxSpeed) {
        p.vx += dir * accel * dt;
        if (Math.abs(p.vx) > maxSpeed && Math.sign(p.vx) === dir) p.vx = dir * maxSpeed;
      } else {
        p.vx = lerp(p.vx, dir * maxSpeed, Math.min(1, dt * 4));
      }
    } else {
      const f = (p.grounded ? PL.friction : PL.friction * 0.25) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
      if (rule === 'wind') p.vx += 300 * dt;
    }

    if (p.bufferT > 0) {
      if (p.coyoteT > 0) {
        p.vy = PL.jumpVel; p.grounded = false; p.coyoteT = 0; p.bufferT = 0;
        p.canDouble = !ch.noDouble; p.jumpCut = false; p.standingOn = null;
        p.sx = 0.75; p.sy = 1.3;
        this.sound.play('jump');
        this.burst(p.cx, p.bottom, 6, '#e8e4d8', 90, 0.35, 5, 600, -1);
      } else if (p.canDouble && !p.grounded) {
        p.vy = PL.djumpVel; p.canDouble = false; p.bufferT = 0; p.jumpCut = false;
        p.spin = -Math.PI * 2;
        p.sx = 0.8; p.sy = 1.25;
        this.sound.play('djump');
        this.burst(p.cx, p.bottom, 10, '#ffd166', 140, 0.4, 5, 200, 0);
      }
    }
    if (!inp.jumpHeld && p.vy < 0 && !p.jumpCut) { p.vy *= 0.45; p.jumpCut = true; }

    // the ring: hold jump in the air to fly
    p.flying = false;
    if (p.ring === 'flight' && !p.grounded && inp.jumpHeld && p.flight > 0 && p.vy > -160) {
      p.flying = true;
      p.vy = Math.max(p.vy - 3600 * dt, -300);
      p.flight -= dt;
      p.jumpCut = true;
      if (Math.random() < dt * 30) this.burst(p.cx, p.bottom, 1, '#ffe08a', 60, 0.5, 4, 120, 1);
      this.story.special('flew');
    }

    const g = (Math.abs(p.vy) < 90 && !p.grounded ? GRAVITY * 0.6 : GRAVITY) * grav;
    p.vy = Math.min(p.vy + g * dt, MAX_FALL * (rule === 'moon' ? 0.7 : 1));

    if (p.standingOn) { p.x += p.standingOn.dx; p.y += p.standingOn.dy; }
    p.standingOn = null;

    const wasGrounded = p.grounded;
    if (this.moveX(p, p.vx * dt)) p.vx = 0;
    const res = this.moveY(p, p.vy * dt);
    p.grounded = false;
    if (res === 'floor') {
      if (!wasGrounded) {
        const hard = p.vy > 500;
        p.sx = hard ? 1.35 : 1.15; p.sy = hard ? 0.65 : 0.85;
        if (hard) this.sound.play('land');
        this.burst(p.cx, p.bottom, hard ? 8 : 4, '#e8e4d8', 70, 0.3, 4, 500, -1);
      }
      p.grounded = true; p.vy = 0; p.canDouble = !ch.noDouble; p.flight = FLIGHT_MAX;
    } else if (res === 'ceiling') {
      p.vy = 0;
    }

    if (p.x < this.cam.x) { p.x = this.cam.x; if (p.vx < 0) p.vx = 0; }

    p.sx += (1 - p.sx) * Math.min(1, dt * 10);
    p.sy += (1 - p.sy) * Math.min(1, dt * 10);
    if (p.spin < 0) p.spin = Math.min(0, p.spin + dt * 14);
    if (p.grounded && Math.abs(p.vx) > 20) {
      p.runPhase += dt * 16 * (Math.abs(p.vx) / PL.maxSpeed);
      if (Math.random() < dt * 8) this.burst(p.cx - p.facing * 10, p.bottom, 1, 'rgba(230,226,216,0.8)', 30, 0.3, 4, 300, -1);
    }
    p.trail.unshift({ x: p.cx - p.facing * 10 * p.scale, y: p.y + 14 * p.scale });
    if (p.trail.length > 9) p.trail.length = 9;

    if (p.y > LEVEL_BOTTOM + 160) this.loseLife('fall');
  }

  updateEnemies(dt) {
    const lv = this.level;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.type === 'walker') {
        e.anim += dt;
        e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
        if (this.moveX(e, e.vx * dt)) { e.dir = -e.dir; e.vx = 60 * e.dir; }
        const r = this.moveY(e, e.vy * dt);
        if (r === 'floor') {
          e.vy = 0;
          const aheadX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
          if (!lv.solidAt(aheadX, e.y + e.h + 2)) { e.dir = -e.dir; e.vx = 60 * e.dir; }
        }
        if (e.y > LEVEL_BOTTOM + 100) e.dead = true;
      } else if (e.type === 'bat') {
        const w = (Math.PI * 2) / e.period;
        const nx = e.x0 + Math.sin(this.worldTime * w + e.phase) * e.ax;
        e.face = nx >= e.x ? 1 : -1;
        e.x = nx;
        e.y = e.y0 + Math.sin(this.worldTime * w * 2 + e.phase) * e.ay;
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  updateBalls(dt) {
    const H = 2.6 * T, bounceV = Math.sqrt(2 * GRAVITY * H);
    for (const b of this.balls) {
      b.vh -= GRAVITY * dt;
      b.h += b.vh * dt;
      if (b.h <= 0) { b.h = 0; b.vh = bounceV; b.sq = 0.7; }
      b.sq += (1 - b.sq) * Math.min(1, dt * 12);
      b.x = b.x0 + Math.sin(this.worldTime * 0.8 + b.phase) * b.range;
    }
  }

  updateVoids(dt) {
    const taste = this.lackTaste;
    for (const v of this.voids) {
      const w = (Math.PI * 2) / v.period;
      v.x = v.x0 + Math.sin(this.worldTime * w + v.phase) * v.ax;
      v.y = v.y0 + Math.sin(this.worldTime * w * 2 + v.phase) * v.ay;
      v.r = 30 + Math.sin(this.time * 3) * 2;
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, d = v.r + 40;
        this.particles.push({ x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, life: 0.45, maxLife: 0.45, color: 'rgba(255,230,205,0.7)', size: 3, gravity: 0 });
      }
      if (taste === 'coins' || taste === 'still') {
        for (const c of this.coins) {
          if (!c.taken && Math.hypot(c.x - v.x, c.y - v.y) < v.r + 4) { c.taken = true; this.burst(c.x, c.y, 6, '#2a1f10', 80, 0.4, 4, 0, 0); }
        }
      }
      if (taste === 'enemies') {
        for (const e of this.enemies) {
          if (!e.dead && Math.hypot(e.x + e.w / 2 - v.x, e.y + e.h / 2 - v.y) < v.r + 12) {
            e.dead = true;
            this.sound.play('swallow');
            this.burst(e.x + e.w / 2, e.y + e.h / 2, 12, '#000', 120, 0.5, 6, 0, 0);
          }
        }
      }
    }
    if (this.coins.some((c) => c.taken)) this.coins = this.coins.filter((c) => !c.taken);
  }

  updateCracks(dt) {
    const p = this.player;
    for (const k of this.cracks) {
      if (k.state === 'idle') {
        let trigger = false;
        if (k.mode === 'behind') {
          const on = p.grounded && Math.floor((p.bottom + 2) / T) === k.row && p.x + p.w > k.c0 * T && p.x < (k.c1 + 1) * T;
          trigger = on;
        } else {
          trigger = p.cx > (k.c0 - 6) * T && p.cx < k.c0 * T;
        }
        if (trigger) {
          k.state = 'rumble';
          k.t = k.mode === 'behind' ? 0.35 : 0.45;
          this.sound.play('rumble');
          if (!this.story.used.has('special:6:tiger')) this.story.special('tiger');
        }
      } else if (k.state === 'rumble') {
        k.t -= dt;
        this.shake = Math.max(this.shake, 0.25);
        if (Math.random() < dt * 30) this.burst(k.x + Math.random() * k.w, k.row * T, 1, '#6b6259', 60, 0.4, 4, 600, -1, 'rect');
        if (k.t <= 0) {
          k.state = 'gone';
          for (let c = k.c0; c <= k.c1; c++) for (let r = k.row; r < ROWS; r++) this.level.set(c, r, 0);
          for (let i = 0; i < 16; i++) this.burst(k.x + Math.random() * k.w, k.row * T + 10, 1, ['#5c6066', '#9a9ea4', '#4c5056'][i % 3], 120, 0.9, 8, 1200, 0.5, 'rect');
          this.sound.play('crumble');
          this.shake = 0.8;
          this.glimpses.push({ x0: k.x, y: k.row * T, w: k.w, t: 0, life: 1.3 });
          this.story.event('collapse', 0.6);
        }
      }
    }
    for (const g of this.glimpses) g.t += dt;
    this.glimpses = this.glimpses.filter((g) => g.t < g.life);
  }

  interactions(dt) {
    const p = this.player;
    const prect = { x: p.x + 4 * p.scale, y: p.y + 4 * p.scale, w: p.w - 8 * p.scale, h: p.h - 6 * p.scale };
    const ch = this.chapter;

    for (const c of this.coins) {
      const cr = { x: c.x - 11, y: c.y - 11, w: 22, h: 22 };
      if (overlaps(prect, cr)) {
        c.taken = true;
        this.coinCount++;
        this.ui.coins(this.coinCount);
        this.sound.play('coin');
        this.burst(c.x, c.y, 8, '#ffd24a', 120, 0.4, 5, 300, 0);
        this.texts.push({ x: c.x, y: c.y - 16, text: '+10', life: 0.7, vy: -70, color: '#ffe68a' });
        this.story.event('coin', 0.12);
      }
    }
    if (this.coins.some((c) => c.taken)) this.coins = this.coins.filter((c) => !c.taken);

    for (const it of this.items) {
      const hit = overlaps(prect, it) || (it.type === 'ring' && p.cx > it.x - 4);
      if (!hit) continue;
      it.taken = true;
      const ix = it.x + it.w / 2, iy = it.y + it.h / 2;
      if (it.type === 'heart') {
        this.hearts = Math.min(MAX_HEARTS, this.hearts + 1);
        this.ui.hearts(this.hearts);
        this.sound.play('heart');
        this.burst(ix, iy, 16, '#ff5a7a', 160, 0.6, 6, 200, 0);
        this.texts.push({ x: ix, y: it.y - 10, text: '♥', life: 0.9, vy: -60, color: '#ff8aa0' });
      } else if (it.type === 'ring') {
        p.ring = 'flight';
        p.flight = FLIGHT_MAX;
        this.sound.play('ring');
        this.burst(ix, iy, 26, '#ffe08a', 200, 0.9, 5, 0, 0);
        this.story.special('ring');
      } else if (it.type === 'vase') {
        this.bonus += 100;
        this.sound.play('vase');
        this.burst(ix, iy, 20, '#dbe8ff', 140, 1, 5, 0, 0);
        this.texts.push({ x: ix, y: it.y - 10, text: '+100', life: 1.2, vy: -50, color: '#dbe8ff' });
        this.story.special('vase');
      }
    }
    if (this.items.some((i) => i.taken)) this.items = this.items.filter((i) => !i.taken);

    for (const o of this.doors) {
      if (!o.used && p.cx >= o.x + T * 0.5) { o.used = true; this.enterCrawl(); return; }
    }

    for (const f of this.flags) {
      if (f.active || p.cx < f.x) continue;
      f.active = true;
      this.checkpoint = { x: f.x, y: f.y };
      if (f.gate != null) this.enterChapter(f.gate);
      else {
        this.sound.play('checkpoint');
        this.texts.push({ x: f.x, y: f.y - 120, text: 'CHECKPOINT', life: 1.2, vy: -40, color: '#9dffb0' });
        this.story.event('checkpoint');
      }
      if (this.chapterIdx >= 2) f.tag = true;
      for (let i = 0; i < 24; i++) this.burst(f.x, f.y - 90, 1, ['#4cd964', '#ffd166', '#5ac8fa', '#ff6b9d'][i % 4], 220, 1.1, 6, 500, 0, 'rect');
    }

    for (const b of this.balls) {
      const top = b.base - b.h - 2 * b.r;
      if (p.vy > 0 && Math.abs(p.cx - b.x) < b.r + p.w / 2 - 2 && p.bottom >= top - 2 && p.bottom - p.vy * dt <= top + 10) {
        p.vy = -1050;
        p.y = top - p.h;
        p.canDouble = !ch.noDouble; p.jumpCut = true;
        p.sx = 0.75; p.sy = 1.3;
        b.sq = 0.55;
        this.sound.play('bounce');
        this.burst(b.x, top, 10, '#ff8fb8', 140, 0.5, 5, 300, 0);
        this.story.special('bounce');
      }
    }

    const invisible = p.ring === 'invisible';
    for (const e of this.enemies) {
      if (e.dead) continue;
      const er = { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 6 };
      if (!overlaps(prect, er)) continue;
      if (invisible) { this.story.special('ghost'); continue; }
      const falling = p.vy > 0 || (e.type === 'bat' && p.vy > -50);
      if (falling && p.bottom - p.vy * dt - 6 <= e.y + e.h * 0.5) {
        e.dead = true;
        this.kills++;
        p.vy = -500; p.canDouble = !ch.noDouble; p.jumpCut = true;
        p.sx = 0.8; p.sy = 1.25;
        this.shake = 0.5;
        this.sound.play('stomp');
        this.burst(e.x + e.w / 2, e.y + e.h / 2, 14, e.type === 'bat' ? '#5a4580' : '#a983ff', 200, 0.7, 7, 700, 0);
        const comic = ch.key === 'stoop' || ch.key === 'flight';
        this.texts.push(comic
          ? { x: e.x + e.w / 2, y: e.y - 14, text: COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)], life: 0.8, vy: -50, color: '#ffe14f', comic: true, rot: (Math.random() - 0.5) * 0.4 }
          : { x: e.x + e.w / 2, y: e.y - 10, text: '+25', life: 0.8, vy: -70, color: '#d7c6ff' });
        this.story.event('stomp', 0.5);
      } else {
        this.hurt(e.x + e.w / 2);
      }
    }

    for (const v of this.voids) {
      if (Math.hypot(p.cx - v.x, p.y + p.h / 2 - v.y) > v.r + 10) continue;
      const t = this.lackTaste;
      const likes = (t === 'still' && p.grounded && Math.abs(p.vx) < 40) || (t === 'rising' && p.vy < -40);
      if (likes) {
        this.sound.play('swallow');
        this.burst(p.cx, p.y + p.h / 2, 18, '#000', 160, 0.7, 6, 0, 0);
        this.story.event('swallowed');
        this.loseLife('lack');
        return;
      }
      this.story.special('refused');
    }

    if (p.invuln <= 0) {
      const sr = { x: p.x + 6 * p.scale, y: p.y + 6 * p.scale, w: p.w - 12 * p.scale, h: p.h - 6 * p.scale };
      const x0 = Math.floor(sr.x / T), x1 = Math.floor((sr.x + sr.w) / T);
      const y0 = Math.floor(sr.y / T), y1 = Math.floor((sr.y + sr.h) / T);
      outer: for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          if (this.level.get(cx, cy) === SPIKE) {
            const tile = { x: cx * T + 4, y: cy * T + T * 0.4, w: T - 8, h: T * 0.6 };
            if (overlaps(sr, tile)) { this.hurt(cx * T + T / 2); break outer; }
          }
        }
      }
    }
  }

  hurt(fromX) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'playing') return;
    this.hearts--;
    this.ui.hearts(this.hearts);
    this.shake = 1;
    this.burst(p.cx, p.y + p.h / 2, 12, '#ff5d5d', 180, 0.6, 6, 500, 0);
    if (this.hearts <= 0) { this.die(); return; }
    p.invuln = 1.6;
    p.vx = (p.cx < fromX ? -1 : 1) * 320;
    p.vy = -430;
    p.grounded = false;
    p.jumpCut = true;
    this.sound.play('hurt');
    this.story.event(this.hearts === 1 ? 'low' : 'hurt');
  }

  loseLife(reason) {
    if (this.state !== 'playing') return;
    this.hearts--;
    this.ui.hearts(this.hearts);
    if (this.chapterIdx >= 1) { this.karmaDock += KARMA_FALL; this.pendingDock = true; }
    if (this.hearts <= 0) { this.die(); return; }
    if (reason !== 'lack') { this.sound.play('fall'); this.story.event('fall'); }
    this.state = 'respawn'; this.stateT = 0; this.respawned = false;
  }

  doRespawn() {
    const p = this.player;
    p.scale = 1; p.w = PL.w; p.h = PL.h;
    p.x = this.checkpoint.x - p.w / 2; p.y = this.checkpoint.y - p.h;
    p.vx = 0; p.vy = 0; p.invuln = 1.5; p.grounded = true; p.trail.length = 0; p.standingOn = null;
    p.sx = 1; p.sy = 1; p.spin = 0; p.flight = FLIGHT_MAX;
    this.cam.x = Math.max(this.level.startCol * T, this.checkpoint.x - this.VW * 0.3);
    this.cam.y = this.targetCamY();
    if (this.pendingDock) {
      this.pendingDock = false;
      this.texts.push({ x: p.cx, y: p.y - 20, text: `-${KARMA_FALL} KARMA`, life: 1.4, vy: -40, color: '#ff9a9a' });
    }
  }

  // Nobody dies in this book. Out of hearts, you tumble off the page and into the writer's mind.
  die() {
    const p = this.player;
    p.dead = true;
    p.vy = -650; p.vx = -p.facing * 60;
    this.state = 'dying'; this.stateT = 0;
    this.shake = 1.2;
    this.story.clear();
    this.sound.play('fall');
  }

  recordBest() {
    if (this.score > this.best) { this.best = this.score; writePref('hd_best', String(this.best)); }
  }

  enterMind() {
    this.recordBest();
    const from = this.chapterIdx, next = Math.min(LAST_CHAPTER, from + 1);
    this.mind = new Mind({ from, next, input: this.input, sound: this.sound, story: this.story });
    this.state = 'mind'; this.stateT = 0;
    this.input.reset();
    this.ui.altMode(true);
    this.sound.setArrangement('mind');
    this.sound.setLayers({});
    this.layersKey = null;
    this.story.enterMind(this.mindVisits === 0);
    this.mindVisits++;
  }

  // Leave the mind: erased or forgotten sends you back to your last checkpoint; literary
  // gravity drops you into whichever book you carried more words from.
  exitMind(res) {
    const m = this.mind;
    this.mind = null;
    this.ui.altMode(false);
    let line;
    if (res.type === 'book') {
      const ch = CHAPTERS[res.chapter];
      this.bonus += m.count * 5;
      line = res.chapter > this.chapterIdx ? `You fell into ${ch.title}.` : `You fell back into ${ch.title}, heavier than before.`;
      if (res.chapter > this.chapterIdx) this.jumpToChapter(res.chapter);
    } else {
      line = this.story.pick(res.reason) || 'Back to the page.';
    }
    const p = this.player;
    p.dead = false;
    this.doRespawn();
    p.invuln = 1.5;
    this.hearts = MAX_HEARTS;
    this.ui.hearts(this.hearts);
    this.state = 'playing'; this.stateT = 0; this.fade = 0;
    this.flash = 1;
    this.input.reset();
    this.story.leaveMind(this.chapterIdx, line);
    this.restoreMusic();
  }

  // Dreamed Country bends into a different genre: a turn-based dungeon crawl through the mind.
  enterCrawl() {
    const memory = +readPref('hd_crawl_memory', '0') || 0;
    this.crawl = new Crawl({ memory, sound: this.sound, onKarma: (d) => { this.bonus += d; } });
    this.state = 'crawl'; this.stateT = 0;
    this.input.reset();
    this.story.clear();
    this.ui.altMode(true);
    this.ui.crawlOpen(this.crawl);
    this.crawlMusic = null;
    this.sound.setLayers({});
    this.layersKey = null;
  }

  // Waking up returns you to the door; defeating the Blank Page lets you out into the next chapter.
  exitCrawl(res) {
    this.crawl = null;
    this.ui.crawlClose();
    this.ui.altMode(false);
    let line;
    if (res.type === 'end') {
      line = this.story.lines.crawlEnd || LINES_FALLBACK.end;
      this.bonus += res.karma;
      this.jumpToChapter(CHAPTERS.findIndex((c) => c.key === 'lack'));
    } else {
      line = this.story.pick('crawlWake') || LINES_FALLBACK.wake;
      writePref('hd_crawl_memory', String((+readPref('hd_crawl_memory', '0') || 0) + 1));
      for (const o of this.doors) o.used = false;
    }
    const p = this.player;
    p.dead = false;
    this.doRespawn();
    p.invuln = 1.5;
    if (res.type === 'end') this.texts.push({ x: p.cx, y: p.y - 30, text: `+${res.karma} KARMA`, life: 2, vy: -30, color: '#ffe68a' });
    this.hearts = MAX_HEARTS;
    this.ui.hearts(this.hearts);
    this.state = 'playing'; this.stateT = 0; this.fade = 0;
    this.flash = 1;
    this.input.reset();
    this.story.leaveMind(this.chapterIdx, line);
    this.restoreMusic();
  }

  // Start a fresh stretch of road just before chapter k's gate, keeping the run's totals.
  jumpToChapter(k) {
    this.distanceBank += this.distance;
    this.startChapter = k;
    this.level = new Level((Math.random() * 1e9) | 0, k);
    const s = this.level.startCol;
    this.player = new Player((s + 3) * T + T / 2, 10 * T);
    this.coins = []; this.enemies = []; this.platforms = []; this.items = []; this.flags = [];
    this.balls = []; this.voids = []; this.cracks = []; this.signs = []; this.billboards = []; this.glimpses = []; this.doors = [];
    this.particles = []; this.texts = [];
    this.startMeter = s; this.meter = s; this.distance = 0;
    this.chapterIdx = k - 1;
    this.checkpoint = { x: this.player.cx, y: 10 * T };
    this.cam = { x: s * T, y: LEVEL_BOTTOM + 64 - this.VH };
    this.rule = null;
    this.arrest = { thin: false, hud: false, silence: false, ending: false };
    this.ui.arrestHud(false);
    this.sync();
    this.cam.y = this.targetCamY();
  }

  restoreMusic() {
    const ch = this.chapter;
    this.sound.setArrangement(ch.key === 'flight' && this.player.ring === 'invisible' ? 'hush' : ch.music);
    this.sound.setLayers({});
    this.layersKey = null;
  }

  targetCamY() {
    const p = this.player;
    const minY = -this.VH * 0.5, maxY = LEVEL_BOTTOM + 80 - this.VH;
    const ty = p.y + p.h / 2 - this.VH * 0.55;
    return clamp(ty, Math.min(minY, maxY), maxY);
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x - this.VW * 0.3;
    const kx = 1 - Math.exp(-dt * 6);
    this.cam.x = Math.max(this.cam.x, lerp(this.cam.x, tx, kx));
    const ky = 1 - Math.exp(-dt * 5);
    this.cam.y = lerp(this.cam.y, this.targetCamY(), ky);
  }

  // ---- particles ----------------------------------------------------------
  burst(x, y, n, color, speed, life, size, gravity, biasY, shape) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + (biasY || 0) * s * 0.6,
        life: life * (0.6 + Math.random() * 0.4), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8),
        gravity: gravity || 0, shape,
      });
    }
  }

  updateParticles(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.gravity * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 1 - dt * 2;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  // ---- render -------------------------------------------------------------
  currentTheme() {
    const x = (this.cam.x + this.VW * 0.5) / T;
    let cur = this.startChapter > 0 ? this.startChapter - 1 : 0, next = null;
    for (const g of this.level.gates) {
      if (g.col <= x) cur = g.ci; else { next = g; break; }
    }
    let t = 0;
    if (next) { const dd = next.col - x; if (dd < 18) t = smoothstep(clamp(1 - dd / 18, 0, 1)); }
    let theme = R.blendThemes(R.THEMES[CHAPTERS[cur].theme], next ? R.THEMES[CHAPTERS[next.ci].theme] : null, t);
    if (CHAPTERS[cur].key === 'gray' && t < 1) {
      const prog = clamp((x - 3 - CHAPTERS[cur].start) / 200, 0, 1);
      theme = { ...theme, fog: lerp(theme.fog, 0.3 + 0.55 * prog, 1 - t) };
    }
    return theme;
  }

  render(ctx, dpr, scale) {
    const { VW, VH, cam } = this;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    if (this.state === 'mind' || (this.state === 'paused' && this.prevState === 'mind')) {
      this.mind.render(ctx, VW, VH);
      return;
    }
    if (this.state === 'crawl' || (this.state === 'paused' && this.prevState === 'crawl')) {
      renderBackdrop(ctx, VW, VH, { x: this.time * 30, y: Math.sin(this.time * 0.1) * 40 }, this.time, this);
      return;
    }
    const theme = this.currentTheme();
    this.frozen = theme.frozen > 0.5;
    R.drawBackground(ctx, cam, VW, VH, theme, this.bgTime);

    const sh = this.shake * 7;
    const ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
    ctx.translate(-Math.round(cam.x) + ox, -Math.round(cam.y) + oy);

    R.drawAbyss(ctx, cam, VW);
    for (const s of this.signs) R.drawSign(ctx, s, SIGN_TEXT[s.rule]);
    for (const b of this.billboards) R.drawBillboard(ctx, b, HEADLINES[b.idx % HEADLINES.length]);
    R.drawTiles(ctx, this.level, cam, VW, VH, this.time);
    for (const g of this.glimpses) R.drawGlimpse(ctx, g);
    for (const o of this.doors) R.drawMindDoor(ctx, o, this.time);
    for (const f of this.flags) R.drawFlag(ctx, f, this.time);
    for (const p of this.platforms) R.drawPlatform(ctx, p);
    for (const c of this.coins) R.drawCoin(ctx, c, this.time);
    for (const it of this.items) R.drawItem(ctx, it, this.time);
    for (const b of this.balls) R.drawBall(ctx, b);
    for (const e of this.enemies) {
      if (e.type === 'walker') R.drawWalker(ctx, e); else R.drawBat(ctx, e, this.time);
    }
    for (const v of this.voids) R.drawVoid(ctx, v, this.time);
    const p = this.player;
    const blink = p.invuln > 0 && Math.floor(this.time * 14) % 2 === 0;
    ctx.globalAlpha = p.ring === 'invisible' ? 0.22 + 0.08 * Math.sin(this.time * 5) : blink ? 0.35 : 1;
    R.drawPlayer(ctx, p, this.time);
    ctx.globalAlpha = 1;
    R.drawParticles(ctx, this.particles);
    R.drawTexts(ctx, this.texts);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    R.drawFogWorld(ctx, VW, VH, theme);
    R.drawRain(ctx, VW, VH, theme.rain, this.bgTime);
    if (this.state !== 'title') R.drawRegion(ctx, VW, VH, this.rule, this.time);
    R.drawComic(ctx, VW, VH, theme.comic);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(8,6,16,${this.fade})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (this.state === 'dying' || (this.state === 'paused' && this.prevState === 'dying')) {
      drawWordRain(ctx, VW, VH, clamp((this.stateT - 0.5) / 1.0, 0, 1), this.time);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(250,245,232,${this.flash})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }
}
