// ===================== LEVEL GENERATION =====================
const WORLDS = [
  { name: 'Recess Grove', levels: ['The Swing Set', 'Love Note Lane', 'Cootie Thicket'], boss: 'The Friend Zone' },
  { name: 'Unsent Letter Caves', levels: ['Drafts Folder', 'Echoes of "Hey"', 'The Crystal Diary'], boss: 'The Unsent Letter' },
  { name: 'Left-on-Read Spires', levels: ['Typing...', 'Seen 9:41 PM', 'Double Text Tower'], boss: 'Left On Read' },
  { name: 'Cold Shoulder Peaks', levels: ['Just Friends Ridge', 'The Long Silence', 'Prom Night Summit'], boss: 'The Cold Shoulder' },
  { name: 'The Heartbreak Core', levels: ['The Descent', 'Where Feelings Burn', 'Core Approach'], boss: 'The Heartbreak Core' },
];
function abilitiesFor(world) { return { dj: world >= 1, dash: world >= 2, wall: world >= 3, glide: world >= 4 }; }
function reqOK(req, ab) {
  for (const c of req) {
    if (c === 'd' && !ab.dj) return false;
    if (c === 'x' && !ab.dash) return false;
    if (c === 'w' && !ab.wall) return false;
    if (c === 'g' && !ab.glide) return false;
  }
  return true;
}
function chunkRows(m) {
  let rows = m.split('\n').map(s => s.trim()).filter(s => s.length);
  const w = Math.max(...rows.map(r => r.length));
  rows = rows.map(r => r.length < w ? r + ('#IL'.includes(r[r.length - 1]) ? r[r.length - 1] : '.').repeat(w - r.length) : r);
  while (rows.length < ROWS) rows.unshift('.'.repeat(w));
  return rows;
}

// Plan every stage in order so chunks rotate instead of repeating across stages.
let PLAN = null;
function planAll() {
  PLAN = {};
  const used = new Map();
  for (let world = 0; world < 5; world++) for (let idx = 0; idx < 3; idx++) {
    const R = rng(7919 * (world + 1) + idx * 104729 + 13);
    const ab = abilitiesFor(world);
    const maxD = [[2, 2, 3], [2, 3, 3], [3, 3, 4], [3, 4, 4], [3, 4, 4]][world][idx];
    const zones = idx === 2 ? 2 : 1;
    const count = Math.max(5, [7, 8, 9][idx] + world - 2 * zones);
    const newest = '.dxwg'[world];
    const pool = CHUNKS.filter(c => reqOK(c.req, ab) && (c.th === '*' || c.th.includes(String(world))) && c.d <= maxD);
    const weight = c => (newest !== '.' && c.req.includes(newest) ? 3 : 1) * (c.th !== '*' ? 2.4 : 1) * (c.d === maxD ? 1.3 : 1) / (1 + 1.6 * (used.get(c.id) || 0));
    const pick = list => {
      let tot = 0; for (const c of list) tot += weight(c);
      let r = R() * tot;
      for (const c of list) { r -= weight(c); if (r <= 0) return c; }
      return list[list.length - 1];
    };
    const chosen = [];
    const sp = pool.filter(c => c.m.includes('*'));
    for (let i = 0; i < 3 && sp.length; i++) { const c = pick(sp); chosen.push(c); sp.splice(sp.indexOf(c), 1); }
    let rest = pool.filter(c => !chosen.includes(c));
    while (chosen.length < count) {
      if (!rest.length) rest = pool.slice();
      const c = pick(rest); chosen.push(c); rest.splice(rest.indexOf(c), 1);
    }
    for (const c of chosen) used.set(c.id, (used.get(c.id) || 0) + 1);
    const keys = new Map(chosen.map(c => [c, c.d + R() * 1.8]));
    chosen.sort((a, b) => keys.get(a) - keys.get(b));
    const n = chosen.length, fpAt = idx === 2 ? [Math.floor(n / 3) - 1, Math.floor(2 * n / 3) - 1] : [Math.floor(n / 2) - 1];
    const fpPool = FP_CHUNKS.filter(c => reqOK(c.req, ab) && c.d <= Math.max(1, maxD - 1) + (world >= 2 ? 1 : 0));
    const fps = new Map();
    for (const at of fpAt) {
      const run = [], left = fpPool.slice();
      for (let k = 0; k < 3; k++) {
        let tot = 0; const wt = c => 1 / (1 + 2 * (used.get(c.id) || 0));
        for (const c of left) tot += wt(c);
        let r = R() * tot, pickc = left[left.length - 1];
        for (const c of left) { r -= wt(c); if (r <= 0) { pickc = c; break; } }
        run.push(pickc); left.splice(left.indexOf(pickc), 1); used.set(pickc.id, (used.get(pickc.id) || 0) + 1);
      }
      fps.set(at, run);
    }
    PLAN[world + '-' + idx] = { chosen, mirror: chosen.map(() => R() < 0.5), seed: R(), fps };
  }
}
function buildLevel(world, idx) {
  if (!PLAN) planAll();
  const pl = PLAN[world + '-' + idx];
  const parts = [chunkRows(START_CHUNK)];
  const ids = [];
  pl.chosen.forEach((c, i) => {
    let rows = chunkRows(c.m);
    if (pl.mirror[i]) rows = rows.map(r => [...r].reverse().join(''));
    parts.push(rows); ids.push(c.id);
    if (HUB && idx === 0 && i === 0) parts.push(chunkRows(PORTAL_CHUNK));
    if (pl.fps.has(i)) {
      parts.push(chunkRows(GATE_IN_CHUNK));
      for (const c of pl.fps.get(i)) { parts.push(chunkRows(c.m)); ids.push(c.id); }
      parts.push(chunkRows(GATE_OUT_CHUNK));
    } else if ((i + 1) % 2 === 0 && i < pl.chosen.length - 1) parts.push(chunkRows(CHECK_CHUNK));
  });
  parts.push(chunkRows(GOAL_CHUNK));
  const rows = [];
  for (let y = 0; y < ROWS; y++) rows.push(parts.map(p => p[y]).join(''));
  const L = makeLevel(rows, world, rng(Math.floor(pl.seed * 1e9)));
  L.chunkIds = ids;
  const gx = L.ents.filter(d => d.type === 'Y').map(d => d.x + 8).sort((a, b) => a - b);
  for (let k = 0; k + 1 < gx.length; k += 2) L.fpZones.push([gx[k], gx[k + 1]]);
  if (idx === 0) L.tutorial = world;
  return L;
}

function buildArena(world) {
  const rows = ARENAS[world].split('\n');
  const L = makeLevel(rows, world, rng(99 + world));
  L.arena = true;
  return L;
}

function makeLevel(rows, world, R) {
  const h = rows.length, w = rows[0].length;
  const L = {
    w, h, world, grid: new Uint8Array(w * h), crumble: new Map(), broken: new Set(), plats: [], platDefs: [],
    springs: [], updrafts: [], saws: [], ents: [], stars: [], start: null, rows, fpZones: [],
  };
  const G = L.grid;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x] || '.', i = y * w + x;
    switch (ch) {
      case '#': G[i] = T.SOLID; break;
      case 'I': G[i] = T.ICE; break;
      case '=': G[i] = T.ONEWAY; break;
      case '^': G[i] = T.SPIKEUP; break;
      case 'v': G[i] = T.SPIKEDN; break;
      case 'L': G[i] = T.LAVA; break;
      case 'X': G[i] = T.CRUMBLE; break;
      case 'B': G[i] = T.BREAK; break;
      case 'U': G[i] = T.VENT; break;
      case 'P': L.start = { x: x * 16 + 3, y: y * 16 + 16 - PH.ph }; break;
      case 'o': L.ents.push({ type: 'ember', x: x * 16 + 8, y: y * 16 + 8 }); break;
      case 'H': L.ents.push({ type: 'heart', x: x * 16 + 8, y: y * 16 + 8 }); break;
      case '*': L.stars.push({ x: x * 16 + 8, y: y * 16 + 8 }); break;
      case 'S': L.springs.push({ x: x * 16, y: y * 16, t: 0 }); break;
      case 'M': L.platDefs.push({ kind: 'h', x: x * 16 + 8 - 24, y: y * 16, w: 48, h: 8, range: 56 }); break;
      case 'N': L.platDefs.push({ kind: 'v', x: x * 16 + 8 - 24, y: y * 16, w: 48, h: 8, range: 112 }); break;
      case 'F': L.platDefs.push({ kind: 'f', x: x * 16, y: y * 16, w: 32, h: 8 }); break;
      case 'O': L.saws.push({ x: x * 16 + 8, y: y * 16 + 8, r: 10 }); break;
      case '.': break;
      default: L.ents.push({ type: ch, x: x * 16, y: y * 16 });
    }
  }
  // world-specific dressing
  if (world === 4) {
    for (let x = 0; x < w; x++) if (G[16 * w + x] === T.AIR && G[15 * w + x] === T.AIR) { G[16 * w + x] = T.LAVA; G[15 * w + x] = T.LAVA; }
  }
  if (world === 1 && !L.arena) {
    for (let x = 0; x < w; x++) {
      const clear = r => G[r * w + x] === T.AIR && !'*oVfS'.includes(rows[r][x]);
      if (clear(0) && clear(1) && clear(2)) {
        G[x] = T.SOLID;
        if (R() < 0.55 && clear(3)) G[w + x] = T.SOLID;
      }
    }
  }
  // updrafts
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (G[y * w + x] === T.VENT) {
    let top = y;
    while (top > 1 && y - top < 12 && !isSolidT(L, x, top - 1)) top--;
    L.updrafts.push({ x: x * 16, y: top * 16, w: 16, h: (y - top) * 16 });
  }
  // stars: keep 3 spread, others become embers
  if (L.stars.length > 3) {
    const s = L.stars.slice().sort((a, b) => a.x - b.x), n = s.length;
    const keep = [s[0], s[Math.round((n - 1) / 2)], s[n - 1]];
    for (const st of s) if (!keep.includes(st)) L.ents.push({ type: 'ember', x: st.x, y: st.y });
    L.stars = keep;
  }
  return L;
}
