// Reachability solver: runs the game's real player physics over every level chunk and
// confirms each one (and its hidden Mixtape) can be reached with the moves available.
// Usage: node tools/check-chunks.js [--fp] [chunkId]
const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, Map, Set, Uint8Array, String, Array, Object };
vm.createContext(ctx);
for (const f of ['core.js', 'chunks.js', 'levelgen.js']) vm.runInContext(fs.readFileSync(__dirname + '/../src/' + f, 'utf8'), ctx);
const useFP = process.argv.includes('--fp');
const { CHUNKS: ALL, FP_CHUNKS, chunkRows, makeLevel, newPlayer, stepPlayer, PH, rng } = vm.runInContext('({CHUNKS,FP_CHUNKS,chunkRows,makeLevel,newPlayer,stepPlayer,PH,rng})', ctx);
const CHUNKS = useFP ? FP_CHUNKS : ALL;

function abFromReq(req) { return { dj: req.includes('d'), dash: req.includes('x'), wall: req.includes('w'), glide: req.includes('g') }; }

function solve(chunk, ab, mirror) {
  let rows = chunkRows(chunk.m);
  const cw = rows[0].length;
  const bad = rows.filter(r => r.length !== cw);
  if (bad.length) return { err: 'row width mismatch' };
  if (mirror) rows = rows.map(r => [...r].reverse().join(''));
  const pad = n => rows.map((r, y) => (y >= 14 ? '#' : '.').repeat(n));
  const left = pad(4), right = pad(4);
  const full = rows.map((r, y) => left[y] + r + right[y]);
  const L = makeLevel(full, 0, rng(1));
  L.breakAll = ab.dash;
  // static platforms spanning their movement range
  for (const d of L.platDefs) {
    if (d.kind === 'h') L.plats.push({ x: d.x - d.range, y: d.y, w: d.w + 2 * d.range, h: 8, vx: 0, vy: 0 });
    else if (d.kind === 'v') for (let k = 0; k <= d.range; k += 16) L.plats.push({ x: d.x, y: d.y - k, w: d.w, h: 8, vx: 0, vy: 0 });
    else L.plats.push({ x: d.x, y: d.y, w: d.w, h: 8, vx: 0, vy: 0 });
  }
  const goalX = (4 + cw) * 16 + 8;
  const starsHit = new Set();
  const P0 = newPlayer(20, 14 * 16 - PH.ph);
  const acts = [];
  for (const hz of [-1, 0, 1]) for (const jm of [0, 1, 2]) acts.push({ hz, jm, dash: null });
  if (ab.dash) for (const [dx, dy] of [[1, 0], [-1, 0], [1, -1], [-1, -1], [0, -1], [1, 1], [-1, 1], [0, 1]]) acts.push({ hz: dx, jm: 2, dash: [dx, dy] });
  const key = P => [Math.round(P.x / 4), Math.round(P.y / 4), Math.round(P.vx / 60), Math.round(P.vy / 90),
    +P.onGround, +P.canDJ, +P.dashAvail, +(P.dashT > 0), +(P.wallLock > 0), +P.glideArmed, +P.jumping].join(',');
  const FR = 6, dt = 1 / 60;
  function search(h, done) {
    // greedy best-first on heuristic h(P)
    const heap = [];
    const push = (P) => { const e = [h(P), P]; heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    const seen = new Set([key(P0)]);
    push(P0); let n = 0;
    while (heap.length && n < 40000) {
      const S = pop(); n++;
      for (const a of acts) {
        const P = Object.assign({}, S);
        let dead = false, hit = false;
        for (let f = 0; f < FR; f++) {
          const inp = { left: a.hz < 0, right: a.hz > 0, up: a.dash ? a.dash[1] < 0 : false, down: a.dash ? a.dash[1] > 0 : false,
            jump: a.jm > 0, jumpPressed: a.jm === 1 && f === 0, dashPressed: !!a.dash && f === 0 };
          if (stepPlayer(P, inp, L, dt, ab, null)) { dead = true; break; }
          if (done(P)) { hit = true; break; }
        }
        if (dead) continue;
        if (hit) return true;
        const k = key(P);
        if (seen.has(k)) continue;
        seen.add(k); push(P);
      }
    }
    return false;
  }
  const goalDone = P => P.x > goalX && P.onGround;
  const ok = search(P => (goalX - P.x) + Math.abs(P.y - 210) * 0.3, goalDone) || search(P => P.y + (goalX - P.x) * 0.15 + (P.wall ? -6 : 0), goalDone) || search(P => P.y * 2 + (goalX - P.x) * 0.1, goalDone);
  for (const s of L.stars) {
    if (search(P => Math.hypot(P.x + 5 - s.x, (P.y + 7 - s.y) * 1.3), P => Math.abs(P.x + 5 - s.x) < 13 && Math.abs(P.y + 7 - s.y) < 13)) starsHit.add(s);
  }
  return { ok, stars: starsHit.size, totalStars: L.stars.length };
}

const only = process.argv.slice(2).find(a => !a.startsWith('--'));
let fails = 0;
for (const c of CHUNKS) {
  if (only && c.id !== only) continue;
  const ab = abFromReq(c.req);
  const out = [];
  for (const mir of [false, true]) {
    const r = solve(c, ab, mir);
    if (r.err) { out.push(r.err); fails++; break; }
    const tag = (r.ok ? 'OK' : 'FAIL') + (r.totalStars ? ` star ${r.stars}/${r.totalStars}` : '');
    if (!r.ok || r.stars < r.totalStars) fails++;
    out.push(`${mir ? 'mir' : 'fwd'}:${tag}`);
    if (!r.ok || mir) break;
  }
  // is it beatable with fewer abilities? (informational)
  let weaker = '';
  if (c.req) {
    const r = solve(c, abFromReq(c.req.slice(0, -1)), false);
    if (r.ok) weaker = '  (also beatable without ' + c.req.slice(-1) + ')';
  }
  console.log(c.id.padEnd(15), out.join(' '), weaker);
}
console.log('fails:', fails);
