// ===================== BOSSES =====================
const FLOOR = 224, AL = 16, AR = 464;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function makeBoss(w) {
  const B = [bossBeetle, bossWyrm, bossTyrant, bossOwl, bossSmother][w]();
  B.name = WORLDS[w].boss; B.chip = 0;
  return B;
}

// ---------------- 1: Bramble Beetle ----------------
function bossBeetle() {
  const B = { name: 'Bramble Beetle', hp: 3, maxHp: 3, x: 330, y: -80, w: 46, h: 26, vx: 0, vy: 0, face: -1, st: 'intro', t: 0, flash: 0, hits: [], weak: null, throwT: 1.4, anim: 0 };
  B.update = function (dt, G) {
    const P = G.P, ph = this.maxHp - this.hp, cx = this.x + this.w / 2;
    this.t -= dt; this.anim += dt; if (this.flash > 0) this.flash -= dt;
    let move = false;
    switch (this.st) {
      case 'intro':
        this.vy += 900 * dt; this.y += this.vy * dt;
        if (this.y >= FLOOR - this.h) { this.y = FLOOR - this.h; this.vy = 0; shake(G, 7); sfx('boom'); dust(G, cx, FLOOR, 14); this.st = 'roar'; this.t = 1.1; sfx('roar'); }
        break;
      case 'roar': if (this.t <= 0) { this.st = 'walk'; this.t = 2; } break;
      case 'walk':
        this.face = P.x + 5 < cx ? -1 : 1; this.vx = this.face * (40 + 16 * ph); move = true;
        if (ph >= 1) {
          this.throwT -= dt;
          if (this.throwT <= 0) {
            this.throwT = 1.6 - 0.35 * ph;
            const dx = (P.x + 5) - cx;
            G.projs.push({ x: cx, y: this.y, vx: clamp(dx / 0.95, -230, 230), vy: -340, g: 700, r: 4, life: 4, kind: 'seed', solid: true });
            sfx('shoot');
          }
        }
        if (this.t <= 0) { this.st = 'wind'; this.t = 0.7 - 0.12 * ph; this.vx = 0; sfx('telegraph'); }
        break;
      case 'wind': if (this.t <= 0) { this.st = 'charge'; this.vx = this.face * (245 + 45 * ph); sfx('whoosh'); } break;
      case 'charge':
        move = true;
        if (Math.random() < 0.7) G.parts.push(part(cx - this.face * 22, FLOOR - 2, -this.face * 40 * Math.random(), -30 * Math.random(), 0.5, '#6b5440', 2));
        break;
      case 'stun': if (this.t <= 0) { this.st = 'recover'; this.t = 0.45; } break;
      case 'recover': if (this.t <= 0) { this.st = 'walk'; this.t = 1.5 + Math.random(); } break;
      case 'hurt':
        if (this.t <= 0) {
          if (ph >= 2) { this.st = 'leap'; this.vy = -480; this.face = P.x + 5 < cx ? -1 : 1; this.vx = clamp(((P.x + 5) - cx) / 1.0, -220, 220); sfx('whoosh'); }
          else { this.st = 'walk'; this.t = 1.6; }
        }
        break;
      case 'leap':
        this.vy += 960 * dt; this.y += this.vy * dt; move = true;
        if (this.y >= FLOOR - this.h && this.vy > 0) {
          this.y = FLOOR - this.h; this.vy = 0; this.vx = 0; shake(G, 6); sfx('boom'); dust(G, cx, FLOOR, 12);
          for (const d of [-1, 1]) G.projs.push({ x: cx + d * 26, y: FLOOR - 7, vx: d * 170, vy: 0, g: 0, r: 7, life: 4, kind: 'wave', solid: true });
          this.st = 'walk'; this.t = 1.8;
        }
        break;
    }
    if (move) {
      this.x += this.vx * dt;
      if (this.x < AL || this.x + this.w > AR) {
        this.x = clamp(this.x, AL, AR - this.w);
        if (this.st === 'charge') {
          this.st = 'stun'; this.t = 2.3 - 0.3 * ph; this.vx = 0; shake(G, 10); sfx('boom'); dust(G, this.x < 100 ? AL : AR, 180, 16);
          if (ph >= 1) for (let i = 0; i < 2 + ph; i++) G.projs.push({ x: 40 + Math.random() * 400, y: 18, vx: 0, vy: 0, g: 650, r: 6, life: 4, kind: 'rock', solid: true, delay: 0.5 + i * 0.35 });
        }
      }
    }
    // hit shapes
    this.hits = []; this.weak = null;
    if (this.st === 'stun') this.weak = { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 };
    else if (this.st !== 'intro' || this.y > 0) this.hits.push({ x: this.x + 3, y: this.y + 5, w: this.w - 6, h: this.h - 5 });
  };
  B.onHit = function () { this.st = 'hurt'; this.t = 0.6; this.vx = 0; };
  B.draw = function (g) {
    const x = Math.round(this.x), y = Math.round(this.y), flip = this.st === 'stun' || this.st === 'recover', f = this.flash > 0 && Math.floor(this.flash * 20) % 2;
    const body = f ? '#ffffff' : '#3b2a1f', dark = f ? '#ffffff' : '#22170f', thorn = '#cdb68a';
    const sh = this.st === 'wind' ? Math.round(Math.random() * 2 - 1) : 0;
    g.save(); g.translate(x + this.w / 2 + sh, y + this.h / 2);
    if (this.face > 0) g.scale(-1, 1);
    if (flip) g.scale(1, -1);
    // legs
    for (let i = 0; i < 3; i++) {
      const lx = -14 + i * 12, wig = flip ? Math.sin(this.anim * 20 + i) * 3 : Math.sin(this.anim * 14 + i * 2) * 2;
      rect(g, lx, 8, 2, 5 + wig, dark); rect(g, lx - 2, 12 + wig, 3, 1, dark);
    }
    g.fillStyle = body; g.beginPath(); g.ellipse(2, 0, 21, 12, 0, Math.PI, 0); g.fill();
    rect(g, -19, 0, 42, 9, body);
    rect(g, -19, 7, 42, 2, dark);
    g.fillStyle = thorn;
    for (let i = 0; i < 6; i++) { const tx = -14 + i * 6; g.beginPath(); g.moveTo(tx - 2, -8 + Math.abs(i - 2.5) * 1.5); g.lineTo(tx, -16 + Math.abs(i - 2.5) * 2); g.lineTo(tx + 2, -8 + Math.abs(i - 2.5) * 1.5); g.fill(); }
    if (flip) { rect(g, -15, -2, 30, 6, '#8a6a48'); rect(g, -6, -1, 12, 3, '#ffb36a'); }
    // head
    rect(g, -27, -2, 10, 10, body);
    g.fillStyle = thorn; g.beginPath(); g.moveTo(-27, 6); g.lineTo(-33, 9); g.lineTo(-27, 9); g.fill();
    rect(g, -25, 0, 3, 2, this.st === 'wind' || this.st === 'charge' ? '#ff4a2a' : '#ffb347');
    g.restore();
    if (this.st === 'stun') for (let i = 0; i < 3; i++) rect(g, Math.round(x + this.w / 2 + Math.cos(this.anim * 5 + i * 2.1) * 14), Math.round(y - 8 + Math.sin(this.anim * 5 + i * 2.1) * 3), 2, 2, '#fff2a0');
  };
  B.lights = function () { return this.st === 'stun' ? [{ x: this.x + this.w / 2, y: this.y + 10, r: 40 }] : []; };
  return B;
}

// ---------------- 2: Crystal Wyrm ----------------
function bossWyrm() {
  const B = { name: 'Crystal Wyrm', hp: 3, maxHp: 3, hx: 240, hy: 300, hvx: 0, hvy: 0, trail: [], st: 'intro', t: 0.8, leaps: 0, tx: 240, flash: 0, hits: [], weak: null, anim: 0, spat: false };
  B.seg = (i) => { const k = Math.min(B.trail.length - 1, (i + 1) * 5); return B.trail[k] || [B.hx, B.hy]; };
  B.update = function (dt, G) {
    const P = G.P, ph = this.maxHp - this.hp;
    this.t -= dt; this.anim += dt; if (this.flash > 0) this.flash -= dt;
    switch (this.st) {
      case 'intro':
        if (this.t <= 0) { this.hy += (130 - this.hy) * 3 * dt; this.hx = 240 + Math.sin(this.anim * 2) * 10; if (this.hy < 140 && !this.roared) { this.roared = true; sfx('roar'); shake(G, 6); this.t = -0.01; this.rt = 1.2; } }
        if (this.roared) { this.rt -= dt; if (this.rt <= 0) { this.st = 'dive'; } }
        break;
      case 'dive':
        this.hy += 360 * dt;
        if (this.hy > 290) { this.st = 'under'; this.t = 0.9; this.pickTarget(G); }
        break;
      case 'under':
        if (Math.random() < 0.6) G.parts.push(part(this.tx + (Math.random() - 0.5) * 24, FLOOR, (Math.random() - 0.5) * 40, -60 - Math.random() * 60, 0.5, '#8be3ff', 2, 300));
        if (this.t <= 0) {
          this.st = 'leap'; this.hx = this.tx; this.hy = 250; this.spat = false;
          this.hvx = (this.tx < 240 ? 1 : -1) * (140 + 25 * ph); this.hvy = -(510 + 25 * ph);
          sfx('whoosh'); shake(G, 4);
        }
        break;
      case 'leap':
        this.hvy += 720 * dt; this.hx += this.hvx * dt; this.hy += this.hvy * dt;
        if (ph >= 1 && !this.spat && this.hvy > 0) {
          this.spat = true; sfx('shoot');
          for (const vx of [-110, 0, 110]) G.projs.push({ x: this.hx, y: this.hy, vx, vy: 40, g: 380, r: 4, life: 4, kind: 'shard', solid: true });
        }
        if (this.hy > 270 && this.hvy > 0) {
          this.leaps++;
          if (this.leaps >= 2 + ph) { this.leaps = 0; this.st = 'prep'; this.t = 0.7; this.rx = (P.x + 5 < 240) ? 320 : 160; sfx('telegraph'); }
          else { this.st = 'under'; this.t = 0.75 - 0.12 * ph; this.pickTarget(G); }
        }
        break;
      case 'prep':
        if (Math.random() < 0.8) G.parts.push(part(this.rx + (Math.random() - 0.5) * 30, FLOOR, (Math.random() - 0.5) * 50, -80 - Math.random() * 60, 0.5, '#d8a8ff', 2, 300));
        if (this.t <= 0) {
          this.st = 'rear'; this.t = 2.9 - 0.3 * ph; this.hx = this.rx; this.hy = 260; shake(G, 5); sfx('roar');
          const n = 2 + ph;
          for (let i = 0; i < n; i++) G.projs.push({ x: i === 0 ? clamp(P.x + 5, 30, 450) : 40 + Math.random() * 400, y: 18, vx: 0, vy: 0, g: 620, r: 5, life: 4, kind: 'shard', solid: true, delay: 0.7 + i * 0.45 });
        }
        break;
      case 'rear':
        this.hy += (140 + Math.sin(this.anim * 3) * 5 - this.hy) * 5 * dt;
        this.hx = this.rx + Math.sin(this.anim * 2) * 8;
        if (this.t <= 0) this.st = 'dive';
        break;
      case 'hurt':
        this.hy += 200 * dt; if (this.t <= 0) this.st = 'dive';
        break;
    }
    this.trail.unshift([this.hx, this.hy]); if (this.trail.length > 60) this.trail.pop();
    if (this.st === 'rear') { for (let i = 0; i < this.trail.length; i++) this.trail[i] = [this.hx + Math.sin(this.anim * 3 + i * 0.2) * 3, this.hy + i * 3]; }
    this.hits = []; this.weak = null;
    if (this.st === 'rear' && this.hy < 170) this.weak = { x: this.hx - 12, y: this.hy - 12, w: 24, h: 18 };
    else if (this.hy < FLOOR) this.hits.push({ cx: this.hx, cy: this.hy, r: 10 });
    for (let i = 0; i < 8; i++) { const [sx, sy] = this.seg(i); if (sy < FLOOR - 4 && (this.st !== 'rear' || sy > this.hy + 20)) this.hits.push({ cx: sx, cy: sy, r: 7 }); }
  };
  B.pickTarget = function (G) { this.tx = clamp(G.P.x + 5 + (Math.random() - 0.5) * 80, 60, 420); };
  B.onHit = function () { this.st = 'hurt'; this.t = 0.5; };
  B.draw = function (g) {
    g.save(); g.beginPath(); g.rect(0, 0, VW, FLOOR); g.clip();
    const f = this.flash > 0 && Math.floor(this.flash * 20) % 2;
    for (let i = 7; i >= 0; i--) {
      const [sx, sy] = this.seg(i), r = 8 - i * 0.35;
      circ(g, sx, sy, r, f ? '#ffffff' : '#2b2148'); circ(g, sx, sy - 1, r - 2, f ? '#ffffff' : '#3b2f63');
      g.fillStyle = i % 2 ? '#7ff0ff' : '#c98bff'; g.beginPath(); g.moveTo(sx - 3, sy - r + 2); g.lineTo(sx, sy - r - 5); g.lineTo(sx + 3, sy - r + 2); g.fill();
    }
    const hx = this.hx, hy = this.hy, dir = this.st === 'rear' ? 0 : Math.atan2(this.hvy, this.hvx);
    g.translate(hx, hy); if (this.st !== 'rear') g.rotate(dir + Math.PI / 2);
    g.fillStyle = f ? '#ffffff' : '#2b2148'; g.beginPath(); g.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2); g.fill();
    rect(g, -9, 2, 18, 6, f ? '#ffffff' : '#1b1430');
    rect(g, -6, -4, 3, 2, '#ff6ad5'); rect(g, 3, -4, 3, 2, '#ff6ad5');
    const pulse = this.st === 'rear' ? 0.6 + Math.sin(this.anim * 10) * 0.4 : 0.3;
    g.fillStyle = `rgba(127,240,255,${pulse + 0.4})`; g.beginPath(); g.moveTo(-4, -8); g.lineTo(0, -15); g.lineTo(4, -8); g.lineTo(0, -5); g.fill();
    g.fillStyle = '#c6f5ff'; g.beginPath(); g.moveTo(-10, -6); g.lineTo(-14, -16); g.lineTo(-6, -10); g.fill(); g.beginPath(); g.moveTo(10, -6); g.lineTo(14, -16); g.lineTo(6, -10); g.fill();
    g.restore();
    if (this.st === 'rear' || this.st === 'prep') { for (let i = 0; i < 5; i++) rect(g, Math.round((this.rx || 240) - 16 + i * 8), FLOOR - 2, 5, 2, '#55467e'); }
  };
  B.lights = function () { return this.hy < FLOOR ? [{ x: this.hx, y: this.hy, r: this.st === 'rear' ? 70 : 45 }] : []; };
  return B;
}

// ---------------- 3: Tick Tyrant ----------------
function bossTyrant() {
  const B = { name: 'Tick Tyrant', hp: 4, maxHp: 4, x: 240, y: -50, r: 26, vy: 0, st: 'intro', t: 1.6, next: 'gears', flash: 0, hits: [], weak: null, anim: 0, open: 0, n: 0 };
  B.update = function (dt, G) {
    const P = G.P, ph = this.maxHp - this.hp, pcx = P.x + 5;
    this.t -= dt; this.anim += dt; if (this.flash > 0) this.flash -= dt;
    switch (this.st) {
      case 'intro': this.y += (66 - this.y) * 2.5 * dt; if (this.t <= 0) { sfx('roar'); this.st = 'float'; this.t = 1.2; } break;
      case 'float':
        this.x += (clamp(pcx, 60, 420) - this.x) * 0.9 * dt; this.y = 66 + Math.sin(this.anim * 2) * 6;
        if (this.t <= 0) {
          if (this.next === 'gears') { this.st = 'gears'; this.n = 3 + ph; this.t = 0.2; this.next = 'slam'; }
          else { this.st = 'track'; this.t = 0.95 - 0.1 * ph; this.next = 'gears'; sfx('telegraph'); }
        }
        break;
      case 'gears':
        this.y = 66 + Math.sin(this.anim * 2) * 6;
        if (this.t <= 0) {
          if (this.n-- > 0) {
            const dir = Math.random() < 0.7 ? Math.sign(pcx - this.x) || 1 : -(Math.sign(pcx - this.x) || 1);
            G.projs.push({ x: this.x, y: this.y + 20, vx: dir * (70 + Math.random() * 70 + ph * 15), vy: -150, g: 900, r: 7, life: 7, kind: 'gear', solid: true, bounce: 2 });
            sfx('shoot'); this.t = 0.38 - ph * 0.05;
          } else { this.st = 'float'; this.t = 1.1 - 0.15 * ph; }
        }
        break;
      case 'track':
        this.x += (clamp(pcx, 44, 436) - this.x) * 6 * dt; this.y += (52 - this.y) * 4 * dt;
        if (this.t <= 0) { this.st = 'shiver'; this.t = 0.28; }
        break;
      case 'shiver': if (this.t <= 0) { this.st = 'slam'; this.vy = 0; } break;
      case 'slam':
        this.vy += 2200 * dt; this.y += this.vy * dt;
        if (this.y + this.r >= FLOOR) {
          this.y = FLOOR - this.r; this.st = 'stuck'; this.t = 2.3 - 0.2 * ph; shake(G, 11); sfx('boom'); dust(G, this.x, FLOOR, 18);
          for (const d of [-1, 1]) G.projs.push({ x: this.x + d * (this.r + 4), y: FLOOR - 7, vx: d * (155 + 35 * ph), vy: 0, g: 0, r: 7, life: 4, kind: 'wave', solid: true });
        }
        break;
      case 'stuck': this.open = Math.min(1, this.open + dt * 4); if (this.t <= 0) { this.st = 'rise'; } break;
      case 'rise': this.open = Math.max(0, this.open - dt * 4); this.y -= 170 * dt; if (this.y <= 66) { this.y = 66; this.st = 'float'; this.t = 1.0 - 0.15 * ph; } break;
    }
    if (this.st !== 'stuck') this.open = Math.max(0, this.open - dt * 4);
    this.hits = []; this.weak = null;
    if (this.st === 'stuck' && this.open > 0.5) this.weak = { x: this.x - 14, y: this.y - 14, w: 28, h: 28 };
    else if (this.st !== 'stuck') this.hits.push({ cx: this.x, cy: this.y, r: this.r - 3 });
  };
  B.onHit = function (G) {
    this.st = 'rise';
    if (this.hp <= 2 && this.hp > 0) for (let i = 0; i < 4; i++) G.projs.push({ x: this.x, y: this.y - 10, vx: (i - 1.5) * 90, vy: -260, g: 900, r: 7, life: 7, kind: 'gear', solid: true, bounce: 1 });
  };
  B.draw = function (g) {
    const x = this.x, y = this.y, r = this.r, f = this.flash > 0 && Math.floor(this.flash * 20) % 2;
    const sh = this.st === 'shiver' ? Math.random() * 3 - 1.5 : 0;
    if (this.st === 'track' || this.st === 'shiver') { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, FLOOR - 1, 24, 4, 0, 0, Math.PI * 2); g.fill(); }
    // pendulum
    const pa = Math.sin(this.anim * 4) * 0.5;
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + r - 4); g.lineTo(x + Math.sin(pa) * 20, y + r + 16); g.stroke();
    circ(g, x + Math.sin(pa) * 20, y + r + 18, 5, '#c79a4a');
    g.save(); g.translate(x + sh, y);
    circ(g, 0, 0, r + 3, f ? '#ffffff' : '#5a4630');
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + this.anim * 0.2; rect(g, Math.cos(a) * (r + 3) - 2, Math.sin(a) * (r + 3) - 2, 4, 4, '#a8823f'); }
    circ(g, 0, 0, r, f ? '#ffffff' : '#c79a4a');
    // core behind face
    circ(g, 0, 0, r - 4, '#2a1a0c');
    const glow = this.st === 'stuck' ? 0.6 + Math.sin(this.anim * 14) * 0.4 : 0.3;
    circ(g, 0, 0, 9, `rgba(255,140,40,${glow})`); circ(g, 0, 0, 5, '#ffe08a');
    // face plates split open
    const o = this.open * 14;
    g.fillStyle = f ? '#ffffff' : '#efe2c4';
    g.beginPath(); g.arc(-o, 0, r - 4, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.beginPath(); g.arc(o, 0, r - 4, -Math.PI / 2, Math.PI / 2); g.fill();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, side = Math.cos(a) >= 0 ? o : -o; rect(g, side + Math.cos(a) * (r - 8) - 1, Math.sin(a) * (r - 8) - 1, 2, 2, '#5a4630'); }
    if (this.open < 0.3) {
      const ha = this.anim * (this.st === 'float' ? 1 : 6), ma = this.anim * (this.st === 'float' ? 0.2 : 1.5);
      g.strokeStyle = '#2a1a0c'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ha) * 14, Math.sin(ha) * 14); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ma) * 9, Math.sin(ma) * 9); g.stroke();
      rect(g, -9, -8, 5, 3, '#c0301c'); rect(g, 4, -8, 5, 3, '#c0301c');
      rect(g, -10, -11, 7, 1, '#2a1a0c'); rect(g, 3, -11, 7, 1, '#2a1a0c');
    }
    g.restore();
  };
  B.lights = function () { return [{ x: this.x, y: this.y, r: this.st === 'stuck' ? 80 : 40 }]; };
  return B;
}

// ---------------- 4: Hailstorm Owl ----------------
function bossOwl() {
  const B = { name: 'Hailstorm Owl', hp: 4, maxHp: 4, x: 240, y: -60, w: 34, h: 28, vx: 0, vy: 0, st: 'intro', t: 1.5, flash: 0, hits: [], weak: null, anim: 0, iceT: 0.7, gustNext: false, tx: 240, ty: 200, stuckWall: 0 };
  B.update = function (dt, G) {
    const P = G.P, ph = this.maxHp - this.hp, pcx = P.x + 5, pcy = P.y + 7;
    this.t -= dt; this.anim += dt; if (this.flash > 0) this.flash -= dt;
    switch (this.st) {
      case 'intro': this.y += (56 - this.y) * 2 * dt; if (this.t <= 0) { sfx('roar'); this.st = 'hover'; this.t = 1.6; } break;
      case 'hover':
        this.x += (clamp(pcx, 50, 430) - this.x) * 1.6 * dt; this.y = 56 + Math.sin(this.anim * 3) * 6;
        if (ph >= 1) { this.iceT -= dt; if (this.iceT <= 0) { this.iceT = 0.75 - 0.15 * ph; G.projs.push({ x: this.x, y: this.y + 12, vx: 0, vy: 60, g: 520, r: 3, life: 3, kind: 'ice', solid: true }); } }
        if (this.t <= 0) {
          if (ph >= 2 && this.gustNext) { this.st = 'gust'; this.t = 2.0; this.gdir = pcx < 240 ? -1 : 1; sfx('whoosh'); }
          else { this.st = 'screech'; this.t = 0.6 - 0.08 * ph; sfx('telegraph'); }
          this.gustNext = !this.gustNext;
        }
        break;
      case 'gust':
        this.y = 50 + Math.sin(this.anim * 5) * 4;
        G.wind = this.gdir * 430;
        if (Math.random() < 0.9) G.parts.push(part(this.gdir > 0 ? 20 : 460, Math.random() * 220, this.gdir * (200 + Math.random() * 150), 20, 1.6, '#ffffff', 1));
        if (Math.random() < 0.06) G.projs.push({ x: 30 + Math.random() * 420, y: 18, vx: 0, vy: 0, g: 500, r: 3, life: 3, kind: 'ice', solid: true, delay: 0.4 });
        if (this.t <= 0) { this.st = 'screech'; this.t = 0.5; sfx('telegraph'); }
        break;
      case 'screech':
        this.tx = pcx; this.ty = pcy;
        if (this.t <= 0) {
          this.st = 'dive'; this.t = 1.6;
          const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy) || 1, sp = 340 + 35 * ph;
          this.vx = dx / d * sp; this.vy = Math.max(0.35, dy / d) * sp; sfx('whoosh');
        }
        break;
      case 'dive':
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y + this.h / 2 >= FLOOR) { this.y = FLOOR - this.h / 2; this.stick(G, 0); }
        else if (this.x - this.w / 2 <= AL) { this.x = AL + this.w / 2; this.stick(G, -1); }
        else if (this.x + this.w / 2 >= AR) { this.x = AR - this.w / 2; this.stick(G, 1); }
        else if (this.t <= 0) this.st = 'rise';
        break;
      case 'stuck': if (this.t <= 0) this.st = 'rise'; break;
      case 'rise': {
        const dx = clamp(pcx, 60, 420) - this.x, dy = 56 - this.y, d = Math.hypot(dx, dy);
        if (d < 6) { this.st = 'hover'; this.t = 1.5 - 0.2 * ph; }
        else { const sp = Math.min(220, d * 4); this.x += dx / d * sp * dt; this.y += dy / d * sp * dt; }
        break;
      }
    }
    this.hits = []; this.weak = null;
    if (this.st === 'stuck') this.weak = { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    else this.hits.push({ x: this.x - this.w / 2 + 5, y: this.y - this.h / 2 + 5, w: this.w - 10, h: this.h - 8 });
  };
  B.stick = function (G, wall) { this.st = 'stuck'; this.stuckWall = wall; this.t = 2.0 - 0.15 * (this.maxHp - this.hp); shake(G, 9); sfx('boom'); burst(G, this.x, this.y + 10, 18, '#ffffff', 140, 300); };
  B.onHit = function () { this.st = 'rise'; };
  B.draw = function (g) {
    const f = this.flash > 0 && Math.floor(this.flash * 20) % 2, x = this.x, y = this.y;
    const body = f ? '#ffffff' : '#dfe9f6', shade = f ? '#ffffff' : '#9fb7d4';
    g.save(); g.translate(x, y);
    if (this.st === 'stuck') { g.rotate(this.stuckWall === 0 ? Math.PI : this.stuckWall * Math.PI / 2); }
    else if (this.st === 'dive') g.rotate(Math.atan2(this.vy, this.vx) - Math.PI / 2);
    const flap = this.st === 'dive' ? -0.2 : this.st === 'stuck' ? 0.9 : Math.sin(this.anim * 12) * 0.7;
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(flap); g.fillStyle = shade;
      g.beginPath(); g.moveTo(10, -4); g.lineTo(34, -2 + flap * 6); g.lineTo(28, 6); g.lineTo(12, 8); g.fill();
      rect(g, 16, 1, 12, 1, '#ffffff'); g.restore();
    }
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 15, 14, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) rect(g, -8 + i * 4, 4 + (i % 2) * 2, 3, 1, shade);
    g.fillStyle = body; g.beginPath(); g.moveTo(-12, -8); g.lineTo(-14, -18); g.lineTo(-5, -11); g.fill(); g.beginPath(); g.moveTo(12, -8); g.lineTo(14, -18); g.lineTo(5, -11); g.fill();
    const scr = this.st === 'screech';
    circ(g, -6, -3, 5, scr ? '#ff5a3a' : '#ffd84a'); circ(g, 6, -3, 5, scr ? '#ff5a3a' : '#ffd84a');
    circ(g, -6, -3, 2, '#1a2440'); circ(g, 6, -3, 2, '#1a2440');
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.moveTo(-3, 1); g.lineTo(0, 7); g.lineTo(3, 1); g.fill();
    g.restore();
    if (this.st === 'stuck') for (let i = 0; i < 3; i++) rect(g, Math.round(x + Math.cos(this.anim * 5 + i * 2.1) * 16), Math.round(y - 18 + Math.sin(this.anim * 5 + i * 2.1) * 3), 2, 2, '#fff2a0');
  };
  B.lights = function () { return [{ x: this.x, y: this.y, r: 40 }]; };
  return B;
}

// ---------------- 5: The Smother ----------------
function bossSmother() {
  const B = { name: 'The Smother', hp: 6, maxHp: 6, cx: 240, cy: -70, r: 46, st: 'intro', t: 2.6, flash: 0, hits: [], weak: null, anim: 0, si: 0, seq: ['slam', 'orbs', 'expose', 'wave', 'slam', 'expose'], hands: [], lava: false, sub: 0 };
  B.hands = [{ hx: 120, x: 120, y: 120, st: 'idle', t: 0, vy: 0 }, { hx: 360, x: 360, y: 120, st: 'idle', t: 0, vy: 0 }];
  B.phase = function () { return this.hp >= 5 ? 0 : this.hp >= 3 ? 1 : 2; };
  B.update = function (dt, G) {
    const P = G.P, ph = this.phase(), pcx = P.x + 5, pcy = P.y + 7;
    this.t -= dt; this.anim += dt; if (this.flash > 0) this.flash -= dt;
    G.darkBoost = 0.22 * (this.hp / this.maxHp);
    if (Math.random() < 0.5) G.parts.push(part(this.cx + (Math.random() - 0.5) * this.r * 2, this.cy + (Math.random() - 0.5) * this.r, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 1.2, '#0b060d', 3));
    switch (this.st) {
      case 'intro': this.cy += (80 - this.cy) * 1.5 * dt; if (this.t <= 0) { sfx('roar'); shake(G, 8); this.st = 'idle'; this.t = 1; } break;
      case 'idle':
        this.cy += (80 + Math.sin(this.anim * 1.5) * 6 - this.cy) * 3 * dt; this.cx += (240 + Math.sin(this.anim * 0.7) * 40 - this.cx) * 2 * dt;
        if (this.t <= 0) {
          const a = this.seq[this.si++ % this.seq.length];
          this.st = a; this.sub = 0;
          if (a === 'slam') { this.n = 2 + ph; this.startSlam(G); }
          else if (a === 'orbs') { this.t = 2.6; for (let i = 0; i < 3 + ph; i++) { const ang = Math.PI * (0.15 + 0.7 * i / (2 + ph)); G.projs.push({ x: this.cx + Math.cos(ang) * 30, y: this.cy + Math.sin(ang) * 30, vx: Math.cos(ang) * 80, vy: Math.sin(ang) * 80, g: 0, r: 6, life: 5.5, kind: 'smoke', solid: false, delay: i * 0.15 }); } sfx('whoosh'); }
          else if (a === 'wave') { const d = pcx < 240 ? 1 : -1; this.t = 3.2; G.projs.push({ x: d > 0 ? 28 : 452, y: FLOOR - 15, w: 18, h: 30, vx: d * (150 + 25 * ph), vy: 0, g: 0, r: 9, life: 5, kind: 'dwave', solid: false }); sfx('whoosh'); }
          else if (a === 'expose') { this.t = 3.0 - 0.3 * ph; sfx('telegraph'); }
        }
        break;
      case 'slam': {
        const allDone = this.hands.every(h => h.st === 'idle');
        if (allDone && this.n <= 0) { this.st = 'idle'; this.t = 0.8; }
        break;
      }
      case 'orbs': case 'wave': this.cy += (80 - this.cy) * 3 * dt; if (this.t <= 0) { this.st = 'idle'; this.t = 0.6; } break;
      case 'expose':
        this.cy += (148 - this.cy) * 4 * dt; this.cx += (240 - this.cx) * 3 * dt;
        if (this.t <= 0) { this.st = 'idle'; this.t = 1.2; }
        break;
      case 'recoil': this.cy += (70 - this.cy) * 4 * dt; if (this.t <= 0) { this.st = 'idle'; this.t = 0.6; } break;
    }
    // hands
    for (let k = 0; k < 2; k++) {
      const h = this.hands[k];
      h.t -= dt;
      if (h.st === 'idle') { h.x += (this.cx + (k ? 70 : -70) - h.x) * 3 * dt; h.y += (this.cy + 30 + Math.sin(this.anim * 2 + k) * 6 - h.y) * 3 * dt; }
      else if (h.st === 'track') { h.x += (clamp(pcx, 40, 440) - h.x) * 7 * dt; h.y += (40 - h.y) * 5 * dt; if (h.t <= 0) { h.st = 'drop'; h.vy = 0; } }
      else if (h.st === 'drop') { h.vy += 2400 * dt; h.y += h.vy * dt; if (h.y + 14 >= FLOOR) { h.y = FLOOR - 14; h.st = 'rest'; h.t = 0.7; shake(G, 7); sfx('boom'); dust(G, h.x, FLOOR, 10); if (ph >= 1) for (const d of [-1, 1]) G.projs.push({ x: h.x + d * 20, y: FLOOR - 7, vx: d * 170, vy: 0, g: 0, r: 7, life: 3, kind: 'wave', solid: true }); } }
      else if (h.st === 'rest') { if (h.t <= 0) { h.st = 'up'; } }
      else if (h.st === 'up') { h.y -= 260 * dt; if (h.y < 110) { h.st = 'idle'; if (this.st === 'slam' && this.n > 0) this.startSlam(G); } }
    }
    this.hits = []; this.weak = null;
    if (this.st === 'expose' && this.cy > 130) this.weak = { x: this.cx - 11, y: this.cy - 4, w: 22, h: 22 };
    else if (this.st !== 'intro') this.hits.push({ cx: this.cx, cy: this.cy, r: this.r - 10 });
    for (const h of this.hands) if (h.st === 'drop' || h.st === 'rest' || h.st === 'track') this.hits.push({ x: h.x - 13, y: h.y - 10, w: 26, h: 24 });
  };
  B.startSlam = function (G) {
    const h = this.hands[this.sub % 2]; this.sub++; this.n--;
    h.st = 'track'; h.t = 0.8 - 0.1 * this.phase(); sfx('telegraph');
  };
  B.onHit = function (G) {
    this.st = 'recoil'; this.t = 0.9;
    for (const h of this.hands) if (h.st !== 'idle') h.st = 'up';
    if (this.hp === 2 && !this.lava) this.enableLava(G);
  };
  B.enableLava = function (G) {
    this.lava = true; const L = G.L;
    for (const [a, b] of [[5, 10], [19, 24]]) for (let x = a; x <= b; x++) for (let y = 14; y < 17; y++) L.grid[y * L.w + x] = T.LAVA;
    for (const x of [7, 8, 21, 22]) L.updrafts.push({ x: x * 16, y: 32, w: 16, h: 224 - 32 });
    L.lavaTops = []; for (let x = 0; x < L.w; x++) if (L.grid[14 * L.w + x] === T.LAVA) L.lavaTops.push([x, 14]);
    G.lavaRise = 1; shake(G, 14); sfx('boom');
    G.toast = { text: 'The floor melts — ride the updrafts!', t: 3.5 };
  };
  B.draw = function (g) {
    const f = this.flash > 0 && Math.floor(this.flash * 20) % 2, cx = this.cx, cy = this.cy, r = this.r;
    g.globalCompositeOperation = 'lighter'; warmGlow(g, cx, cy, r * 1.5, 0.22, '120,60,160'); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + this.anim * 0.6, rr = r * (0.55 + 0.15 * Math.sin(this.anim * 2 + i));
      circ(g, cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.35, rr, f ? '#ffffff' : '#2a0612');
    }
    heartIcon(g, cx, cy + 4, r * 0.85, f ? '#ffffff' : '#3a0814'); heartIcon(g, cx, cy + 4, r * 0.65, f ? '#ffffff' : '#1a030a');
    const ex = this.st === 'expose';
    const eo = ex ? 3 : 1 + Math.abs(Math.sin(this.anim * 0.8)) * 2;
    g.fillStyle = '#e8e0ff';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 16, cy - 10, 8, eo, s * 0.25, 0, Math.PI * 2); g.fill(); }
    const cg = ex ? 0.7 + Math.sin(this.anim * 12) * 0.3 : 0.25;
    circ(g, cx, cy + 6, 10, `rgba(255,110,40,${cg})`); circ(g, cx, cy + 6, 5, ex ? '#ffe08a' : '#5a2a14');
    for (const h of this.hands) {
      g.fillStyle = f ? '#ffffff' : '#0d070e';
      g.beginPath(); g.ellipse(h.x, h.y, 13, 10, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(h.x - 11 + i * 7, h.y + 4); g.lineTo(h.x - 9 + i * 7, h.y + 15); g.lineTo(h.x - 6 + i * 7, h.y + 4); g.fill(); }
      if (h.st === 'track') { g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(h.x, FLOOR - 1, 16, 3, 0, 0, Math.PI * 2); g.fill(); }
    }
  };
  B.lights = function () { return this.st === 'expose' ? [{ x: this.cx, y: this.cy + 6, r: 70 }] : [{ x: this.cx, y: this.cy + 6, r: 18 }]; };
  return B;
}

// ---------- boss helpers ----------
function shake(G, a) { G.shake = Math.max(G.shake, a); }
function dust(G, x, y, n) { for (let i = 0; i < n; i++) G.parts.push(part(x + (Math.random() - 0.5) * 30, y - 2, (Math.random() - 0.5) * 120, -Math.random() * 80, 0.5 + Math.random() * 0.3, THEMES[G.world].top, 2, 200)); }
