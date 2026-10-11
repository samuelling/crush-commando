// ===================== MEMORIES: the enemies, drawn as memories of crushes =====================
// Every bad guy is somebody he once liked, replayed as a faded, flickering memory: a kid with a
// hairstyle you'd recognise anywhere and cheeks that still blush, an unsent love letter flapping
// like a moth, a phone that only ever says "Seen", the letterman-jacket guy she chose instead.
// They come apart in photo scraps.
const MEM_PAL = [   // per world: clothes, shading, glow
  { shirt: ['#f7a8c4', '#9fd3f2', '#ffe08a', '#b7e4a8', '#d7b8f5'], tint: '255,200,220' },
  { shirt: ['#b9a8ff', '#8fd8ff', '#e3c4ff', '#a0f0e8', '#ffc4e8'], tint: '190,180,255' },
  { shirt: ['#e9c58a', '#d7a06a', '#f0d9a8', '#c99a6a', '#e8b0a0'], tint: '255,215,160' },
  { shirt: ['#cfe6ff', '#e8f4ff', '#a8c8f0', '#d8d0ff', '#bfe8f0'], tint: '210,235,255' },
  { shirt: ['#ff8a8a', '#ffb07a', '#e86a8a', '#ffd0a0', '#c86a9a'], tint: '255,120,110' },
];
const MEM_HAIR = ['#3a2416', '#1a1210', '#d8b45a', '#a8461e', '#6a4a2a', '#2a2a3a'];
const MEM_SKIN = ['#f2c8a0', '#d9a070', '#a86e48', '#e8b890', '#7a4e32'];

function memLook(e) {
  if (e.look === undefined) {
    let h = 2166136261;
    const s = e.uid || String(Math.random());
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    e.look = h >>> 0;
  }
  return e.look;
}
// A ghostly flicker: mostly steady, now and then a jolt sideways with a split colour echo.
function memFlicker(e) {
  const k = Math.sin(e.t * 1.7 + (e.look % 97)) * Math.sin(e.t * 3.1 + (e.look % 13));
  return k > 0.93 ? (Math.sin(e.t * 50) > 0 ? 1 : -1) : 0;
}

// A kid, feet at (cx, by), about 12 px tall. o: { face, look, t, pose: 'walk'|'air'|'arms'|'cross', shirt, flash, h }
function drawKid(g, cx, by, o) {
  cx = Math.round(cx); by = Math.round(by);
  const L = o.look, f = o.face >= 0 ? 1 : -1, hairStyle = L % 6, hair = MEM_HAIR[(L >> 3) % MEM_HAIR.length], skin = MEM_SKIN[(L >> 6) % MEM_SKIN.length];
  const shirt = o.flash ? '#ffffff' : o.shirt, dress = (L >> 9) % 3 === 0, step = Math.floor(o.t * 8) % 2;
  const P = (dx, dy, w, h, c) => rect(g, cx + (f > 0 ? dx : -dx - w + 1), by + dy, w, h, c);
  // legs
  if (o.pose === 'air') { P(-2, -3, 1, 2, '#4a4058'); P(1, -2, 1, 2, '#4a4058'); }
  else { P(-2, -2 - (step && o.pose === 'walk' ? 1 : 0), 1, 2, '#4a4058'); P(1, -2 - (!step && o.pose === 'walk' ? 1 : 0), 1, 2, '#4a4058'); }
  // body: shirt, or a little dress
  P(-3, -7, 6, 5, shirt);
  if (dress) P(-4, -4, 8, 2, shirt);
  P(-3, -7, 6, 1, 'rgba(255,255,255,0.35)');
  // arms
  if (o.pose === 'arms' || o.pose === 'air') { P(-4, -10, 1, 3, skin); P(3, -10, 1, 3, skin); }
  else if (o.pose === 'cross') { P(-2, -6, 4, 1, skin); P(-3, -5, 6, 1, shirt); }
  else { P(-4, -6, 1, 3, skin); P(3, -6 + (step ? 1 : 0), 1, 3, skin); }
  // head
  P(-2, -12, 5, 5, skin);
  // hair
  if (hairStyle === 0) { P(-2, -13, 5, 2, hair); P(-3, -12, 1, 3, hair); P(-4, -11, 1, 4, hair); }                    // ponytail behind
  else if (hairStyle === 1) { P(-3, -13, 7, 2, hair); P(-3, -11, 1, 4, hair); P(3, -11, 1, 4, hair); }               // bob
  else if (hairStyle === 2) { P(-2, -13, 5, 1, hair); P(-4, -11, 2, 2, hair); P(3, -11, 2, 2, hair); }               // pigtails
  else if (hairStyle === 3) { for (let i = -3; i <= 3; i++) P(i, -13 - ((i + 3) % 2), 1, 2, hair); P(-3, -11, 1, 2, hair); }   // curls
  else if (hairStyle === 4) { P(-2, -13, 5, 1, hair); P(1, -12, 2, 1, hair); P(-3, -12, 1, 2, hair); }               // side part
  else { P(-2, -13, 5, 1, hair); P(-1, -15, 3, 2, hair); P(-3, -12, 1, 2, hair); }                                     // bun
  // face: eyes looking ahead, and the blush
  P(0, -10, 1, 1, '#2a1a20'); P(2, -10, 1, 1, '#2a1a20');
  P(-1, -9, 1, 1, '#ff8aa8'); P(3, -9, 1, 1, '#ff8aa8');
}

function drawMemoryKid(g, e, pose, extra) {
  const L = memLook(e), pal = MEM_PAL[G.world] || MEM_PAL[0], j = memFlicker(e);
  const cx = e.x + e.w / 2 + j, by = e.y + e.h, face = Math.sign(e.vx) || e.face || -1;
  const o = { face, look: L, t: e.t, pose, shirt: pal.shirt[(L >> 12) % pal.shirt.length], flash: e.flash > 0 };
  const a0 = g.globalAlpha;
  if (j) { g.globalAlpha = a0 * 0.35; drawKid(g, cx - j * 2, by, Object.assign({}, o, { shirt: '#7ff0ff' })); }
  g.globalAlpha = a0 * (j ? 0.55 : 0.88);
  drawKid(g, cx, by, o);
  g.globalAlpha = a0;
  if (extra) extra(cx, by, face);
}

// enemy drawing, called from drawEnt
function drawMemory(g, e) {
  switch (e.type) {
    case 'walker':
      drawMemoryKid(g, e, 'walk', (cx, by) => {
        // a little heart over their head, floating up now and then
        const k = (e.t * 0.6 + (e.look % 10) / 10) % 1;
        if (k < 0.45) { g.globalAlpha = 0.8 * (1 - k / 0.45); heartIcon(g, cx, by - 17 - k * 10, 2.2, '#ff7aa0'); g.globalAlpha = 1; }
      });
      return true;
    case 'hopper':
      drawMemoryKid(g, e, e.onGround ? 'walk' : 'air', (cx, by) => {
        // giggling: little notes when airborne
        if (!e.onGround) for (let i = 0; i < 2; i++) { const nx = Math.round(cx + (i ? 6 : -7)), ny = Math.round(by - 16 - i * 3 + Math.sin(e.t * 10 + i) * 1); rect(g, nx, ny, 1, 3, '#ffe6f0'); rect(g, nx - 1, ny + 2, 2, 1, '#ffe6f0'); }
      });
      return true;
    case 'spiky':
      // The Rejection: arms crossed, wearing a crown of thorny roses. Don't jump on this one.
      drawMemoryKid(g, e, 'cross', (cx, by) => {
        const top = Math.round(by - 14);
        for (let i = -1; i <= 1; i++) {
          const rx = Math.round(cx + i * 4);
          g.fillStyle = '#2e5a2a'; g.beginPath(); g.moveTo(rx - 1, top); g.lineTo(rx, top - 5); g.lineTo(rx + 1, top); g.fill();
          rect(g, rx - 1, top - 2, 3, 2, i ? '#c8203a' : '#e83a5a');
        }
        rect(g, Math.round(cx - 6), top, 13, 1, '#2e5a2a');
      });
      return true;
    case 'moth': {
      // An unsent love letter, flapping its envelope flaps like wings.
      const x = Math.round(e.x), y = Math.round(e.y + Math.sin(e.t * 6) * 1), flap = Math.sin(e.t * 18), j = memFlicker(e);
      const paper = e.flash > 0 ? '#ffffff' : G.world === 1 ? '#efe6ff' : '#fff4e0';
      g.globalAlpha = j ? 0.55 : 0.95;
      g.fillStyle = paper; g.beginPath();
      g.moveTo(x + 6, y + 3); g.lineTo(x - 2, y + 3 - flap * 6); g.lineTo(x + 1, y + 7); g.closePath();
      g.moveTo(x + 6, y + 3); g.lineTo(x + 14, y + 3 - flap * 6); g.lineTo(x + 11, y + 7); g.closePath(); g.fill();
      rect(g, x + 1, y + 3, 10, 7, paper); rect(g, x + 1, y + 9, 10, 1, '#d8c8b0');
      g.strokeStyle = '#d0b8a0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.5, y + 3.5); g.lineTo(x + 6, y + 7); g.lineTo(x + 10.5, y + 3.5); g.stroke();
      heartIcon(g, x + 6, y + 6.5, 1.8, '#e0304e');
      g.globalAlpha = 1;
      return true;
    }
    case 'turret': {
      // Read receipts: an old phone on a little stand. It types... then fires "Seen".
      const x = Math.round(e.x), y = Math.round(e.y), j = memFlicker(e);
      g.globalAlpha = j ? 0.6 : 1;
      rect(g, x + 5, y + 12, 4, 2, '#4a4a52'); rect(g, x + 3, y + 13, 8, 1, '#4a4a52');
      rect(g, x + 3, y, 8, 13, e.flash > 0 ? '#ffffff' : '#2a2c34'); rect(g, x + 4, y + 2, 6, 8, e.fire > 0 ? '#ffffff' : '#8fd0ff');
      rect(g, x + 6, y + 11, 2, 1, '#6a6c74');
      if (e.fire > 0) { rect(g, x + 5, y + 4, 1, 2, '#1a1a2a'); rect(g, x + 8, y + 4, 1, 2, '#1a1a2a'); rect(g, x + 5, y + 7, 4, 1, '#1a1a2a'); }
      else for (let i = 0; i < 3; i++) if (Math.floor(e.t * 4) % 4 > i) rect(g, x + 5 + i * 2, y + 6, 1, 1, '#1a3a5a');
      g.globalAlpha = 1;
      return true;
    }
    case 'charger': {
      // The guy she chose: letterman jacket, big shoulders, head down when he charges.
      const L = memLook(e), x = Math.round(e.x + (e.st === 'wind' ? Math.random() * 2 - 1 : 0)), by = Math.round(e.y + e.h), f = e.face >= 0 ? 1 : -1;
      const charge = e.st === 'charge', step = Math.floor(e.t * (charge ? 16 : 8)) % 2, j = memFlicker(e);
      const cx = x + 9 + j, P = (dx, dy, w, h, c) => rect(g, cx + (f > 0 ? dx : -dx - w + 1), by + dy, w, h, c);
      const jacket = e.flash > 0 ? '#ffffff' : ['#c02030', '#2050a0', '#207040'][L % 3], skin = MEM_SKIN[(L >> 4) % MEM_SKIN.length];
      g.globalAlpha = j ? 0.55 : 0.92;
      P(-4, -3 + (step ? -1 : 0), 2, 3, '#2a2a40'); P(1, -3 + (step ? 0 : -1), 2, 3, '#2a2a40');
      P(-6, -10, 11, 7, jacket); P(-7, -9, 2, 5, '#f4ead8'); P(4, -9, 2, 5, '#f4ead8');
      P(-1, -8, 3, 3, '#f4ead8'); P(0, -7, 1, 1, jacket);
      const hy = charge ? -11 : -14, hx = charge ? 3 : 0;
      P(-2 + hx, hy, 6, 5, skin); P(-2 + hx, hy - 1, 6, 2, MEM_HAIR[(L >> 7) % MEM_HAIR.length]);
      P(2 + hx, hy + 2, 1, 1, '#1a1010'); P(1 + hx, hy + 4, 3, 1, '#a05040');
      if (e.st === 'stun') for (let i = 0; i < 3; i++) rect(g, Math.round(cx + Math.cos(e.t * 6 + i * 2) * 7), Math.round(by - 17 + Math.sin(e.t * 6 + i * 2) * 2), 1, 1, '#fff6b0');
      g.globalAlpha = 1;
      return true;
    }
  }
  return false;
}

// The troopers: crush after crush charging in, faded like old photos. Shooters hold up a phone.
function drawMemoryRunner(g, e) {
  const f = Math.sign(e.vx) || -1;
  drawMemoryKid(g, e, 'walk', (cx, by) => {
    if (!e.shooter) return;
    const px = Math.round(cx + f * 4), py = Math.round(by - 9);
    rect(g, f > 0 ? px : px - 2, py, 3, 4, '#2a2c34');
    rect(g, f > 0 ? px : px - 2, py + 1, 3, 2, e.aimT > 0 ? '#ffffff' : '#8fd0ff');
  });
}

// What they shoot: texts that say too much, and "Seen" bubbles.
function drawMemoryShot(g, p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  if (p.kind === 'bullet') {
    g.globalCompositeOperation = 'lighter'; warmGlow(g, x, y, 7, 0.45, '255,90,140'); g.globalCompositeOperation = 'source-over';
    heartIcon(g, x, y, 2.6, '#ff5a8a');
    rect(g, x - 1, y - 1, 1, 1, '#ffd0e0');
    return true;
  }
  if (p.kind === 'orb' && p.seen) {
    rect(g, x - 5, y - 3, 11, 7, '#eef6ff'); rect(g, x - 4, y - 4, 9, 1, '#eef6ff'); rect(g, x - 4, y + 4, 9, 1, '#eef6ff');
    rect(g, x - 4 - (p.vx > 0 ? -7 : 0), y + 4, 2, 2, '#eef6ff');
    rect(g, x - 3, y - 1, 1, 2, '#24508a'); rect(g, x - 1, y - 1, 1, 2, '#24508a'); rect(g, x + 2, y - 1, 1, 1, '#24508a'); rect(g, x + 3, y, 1, 1, '#24508a'); rect(g, x + 2, y + 1, 1, 1, '#24508a');
    return true;
  }
  return false;
}

// Photo scraps and a couple of hearts when a memory is destroyed.
function memoryScraps(e) {
  const cx = e.x + (e.w || 10) / 2, cy = e.y + (e.h || 10) / 2, tint = (MEM_PAL[G.world] || MEM_PAL[0]).shirt;
  for (let i = 0; i < 9; i++) G.parts.push(part(cx, cy, (Math.random() - 0.5) * 120, -40 - Math.random() * 90, 0.9 + Math.random() * 0.5, i % 3 === 0 ? tint[i % tint.length] : '#f4ecd8', 2, 260));
  for (let i = 0; i < 3; i++) G.parts.push(part(cx, cy - 4, (Math.random() - 0.5) * 50, -50 - Math.random() * 40, 0.8, '#ff6a90', 1, 60, true));
}
