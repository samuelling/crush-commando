// ===================== RENDER: themes, backgrounds, tiles, primitives =====================
const THEMES = [
  { sky: ['#07161d', '#173c3a'], body: '#3a2a22', deep: '#231812', top: '#4a8236', topHi: '#93cc5c', edge: '#170f0b', plat: '#7a5534', platHi: '#ad7e4e', spike: '#ddd5c2', dark: [4, 12, 16, 0.5], far: '#10302d', mid: '#0a201e', ambient: 'firefly', accent: '#b8f06a' },
  { sky: ['#06040d', '#170e2a'], body: '#2b2140', deep: '#191327', top: '#55467e', topHi: '#a99be0', edge: '#0e0a18', plat: '#6a5aa6', platHi: '#a8efff', spike: '#c6f5ff', dark: [3, 2, 9, 0.8], far: '#120c22', mid: '#0b0716', ambient: 'mote', accent: '#7ff0ff' },
  { sky: ['#1d120b', '#6e3c1f'], body: '#4a3a2c', deep: '#2d241b', top: '#a8823f', topHi: '#efcb7c', edge: '#1b140e', plat: '#666a74', platHi: '#b4b9c4', spike: '#dadce2', dark: [16, 7, 2, 0.42], far: '#3a2215', mid: '#24150c', ambient: 'spark', accent: '#ffcf6a' },
  { sky: ['#060f26', '#22476c'], body: '#5b7594', deep: '#3b4f6b', top: '#e3eefa', topHi: '#ffffff', edge: '#26374f', plat: '#94bde0', platHi: '#e8f7ff', spike: '#eef9ff', dark: [2, 7, 20, 0.28], far: '#17304f', mid: '#0f223a', ambient: 'snow', accent: '#9ff7e0' },
  { sky: ['#0f0404', '#43120a'], body: '#3a2d2b', deep: '#211918', top: '#6b3524', topHi: '#ff8a3a', edge: '#120c0b', plat: '#4a3b39', platHi: '#ff9548', spike: '#cdbcb4', dark: [12, 3, 2, 0.5], far: '#260b07', mid: '#160605', ambient: 'ash', accent: '#ff8a3a' },
];

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function circ(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

function drawFlame(g, x, y, s, t, lean, cols) {
  cols = cols || ['#ff4f1a', '#ff9a2a', '#ffdc6e', '#fff8e4'];
  const fl = Math.sin(t * 23) * 0.12 + Math.sin(t * 37 + 1) * 0.08;
  const H = (9 + fl * 6) * s, W = 4.2 * s;
  const lay = [[cols[0], 1, 1], [cols[1], 0.78, 0.74], [cols[2], 0.52, 0.5], [cols[3], 0.26, 0.28]];
  for (const [c, hm, wm] of lay) {
    const h = H * hm, w = W * wm;
    g.fillStyle = c; g.beginPath();
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x - w, y - h * 0.55, x + lean * H * 0.35, y - h);
    g.quadraticCurveTo(x + w, y - h * 0.55, x + w, y);
    g.arc(x, y, w, 0, Math.PI);
    g.fill();
  }
}

// ---------- backgrounds ----------
function ridge(g, R, base, amp, step, color, W, H, rough) {
  g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
  const pts = []; let y = base;
  for (let x = 0; x <= W; x += step) { y += (R() - 0.5) * amp * (rough || 1); y += (base - y) * 0.25; pts.push([x, y]); }
  pts[pts.length - 1][1] = pts[0][1];
  for (const [x, yy] of pts) g.lineTo(x, yy);
  g.lineTo(W, H); g.closePath(); g.fill();
}
function makeBG(w) {
  const W = 1024, H = VH, R = rng(500 + w), th = THEMES[w];
  const far = mkCanvas(W, H), mid = mkCanvas(W, H);
  const a = far.getContext('2d'), b = mid.getContext('2d');
  if (w === 0) {
    ridge(a, R, 170, 30, 16, th.far, W, H);
    for (let i = 0; i < 40; i++) { const x = R() * W, y = 150 + R() * 40, r = 14 + R() * 22; circ(a, x, y, r, th.far); circ(a, (x + W) % W - (x > W - r ? W : 0), y, r, th.far); }
    for (let i = 0; i < 9; i++) {
      const x = (i + R() * 0.6) * W / 9, tw = 14 + R() * 14;
      rect(b, x, 0, tw, H, th.mid);
      for (let k = 0; k < 3; k++) { const by = 40 + R() * 120; b.fillStyle = th.mid; b.beginPath(); b.moveTo(x + tw / 2, by); b.lineTo(x + tw / 2 + (R() < 0.5 ? -1 : 1) * (30 + R() * 30), by - 20 - R() * 20); b.lineTo(x + tw / 2, by + 6); b.fill(); }
      for (let k = 0; k < 6; k++) rect(b, x + R() * tw, 0, 1, 20 + R() * 60, '#0e2b26');
    }
    ridge(b, R, 230, 20, 12, th.mid, W, H);
  } else if (w === 1) {
    for (let i = 0; i < 70; i++) { const x = R() * W, h = 20 + R() * 70, wd = 8 + R() * 18; a.fillStyle = th.far; a.beginPath(); a.moveTo(x - wd, 0); a.lineTo(x, h); a.lineTo(x + wd, 0); a.fill(); }
    for (let i = 0; i < 50; i++) { const x = R() * W, h = 20 + R() * 60, wd = 8 + R() * 16; a.fillStyle = th.far; a.beginPath(); a.moveTo(x - wd, H); a.lineTo(x, H - h); a.lineTo(x + wd, H); a.fill(); }
    for (let i = 0; i < 90; i++) rect(a, R() * W, R() * H, 1, 1, R() < 0.5 ? '#3b6f8f' : '#6a3f86');
    for (let i = 0; i < 14; i++) {
      const x = R() * W, wd = 20 + R() * 30;
      b.fillStyle = th.mid; b.beginPath(); b.moveTo(x - wd, 0); b.lineTo(x - wd * 0.3, 60 + R() * 60); b.lineTo(x + wd * 0.2, 40 + R() * 40); b.lineTo(x + wd, 0); b.fill();
      const cx = R() * W, cy = 150 + R() * 90, col = R() < 0.5 ? '#2a6b8a' : '#6b2f86';
      for (let k = 0; k < 4; k++) { b.fillStyle = col; b.beginPath(); const bx = cx + k * 7 - 10, hh = 18 + R() * 30; b.moveTo(bx - 4, H); b.lineTo(bx, cy - hh + 60); b.lineTo(bx + 4, H); b.fill(); }
    }
  } else if (w === 2) {
    for (let i = 0; i < 26; i++) {
      const x = R() * W, tw = 16 + R() * 30, h = 70 + R() * 140;
      rect(a, x, H - h, tw, h, th.far);
      a.fillStyle = th.far; a.beginPath(); a.moveTo(x - 3, H - h); a.lineTo(x + tw / 2, H - h - 20 - R() * 30); a.lineTo(x + tw + 3, H - h); a.fill();
      for (let k = 0; k < 8; k++) if (R() < 0.5) rect(a, x + 3 + Math.floor(R() * (tw - 6) / 4) * 4, H - h + 10 + Math.floor(R() * (h - 20) / 8) * 8, 2, 3, R() < 0.7 ? '#e0a23e' : '#ffdf8a');
    }
    ridge(b, R, 236, 6, 32, th.mid, W, H, 0.4);
    for (let i = 0; i < 12; i++) { const x = R() * W; rect(b, x, 180 + R() * 20, 6, 100, th.mid); rect(b, x - 10, 170 + R() * 20, 26, 6, th.mid); }
  } else if (w === 3) {
    a.fillStyle = th.far; a.beginPath(); a.moveTo(0, H);
    const peaks = [];
    for (let x = 0; x <= W; x += 64) { const y = 90 + R() * 80; peaks.push([x, y]); }
    peaks[peaks.length - 1][1] = peaks[0][1];
    for (let i = 0; i < peaks.length; i++) { a.lineTo(peaks[i][0], peaks[i][1]); if (i < peaks.length - 1) a.lineTo(peaks[i][0] + 32, peaks[i][1] + 40 + R() * 20); }
    a.lineTo(W, H); a.fill();
    for (const [x, y] of peaks) { a.fillStyle = '#c9dcf0'; a.beginPath(); a.moveTo(x - 12, y + 16); a.lineTo(x, y); a.lineTo(x + 12, y + 16); a.lineTo(x + 4, y + 12); a.lineTo(x - 2, y + 18); a.fill(); }
    for (let i = 0; i < 30; i++) {
      const x = R() * W, h = 40 + R() * 50, base = 250;
      for (let k = 0; k < 4; k++) { const y0 = base - h + k * h / 4, ww = 6 + k * 5; b.fillStyle = th.mid; b.beginPath(); b.moveTo(x - ww, y0 + h / 4 + 4); b.lineTo(x, y0); b.lineTo(x + ww, y0 + h / 4 + 4); b.fill(); b.fillStyle = '#a9c4de'; b.fillRect(x - ww + 3, y0 + h / 4 + 2, ww * 2 - 6, 2); }
    }
    ridge(b, R, 248, 8, 24, th.mid, W, H, 0.5);
  } else {
    a.fillStyle = th.far; a.beginPath(); a.moveTo(250, H); a.lineTo(420, 95); a.lineTo(480, 92); a.lineTo(650, H); a.fill();
    const gr = a.createLinearGradient(0, 80, 0, 200); gr.addColorStop(0, 'rgba(255,120,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    a.fillStyle = gr; a.fillRect(420, 92, 60, 4);
    for (let k = 0; k < 4; k++) { a.strokeStyle = 'rgba(255,90,30,0.5)'; a.lineWidth = 2; a.beginPath(); let x = 430 + k * 14, y = 96; a.moveTo(x, y); while (y < H) { y += 10; x += (R() - 0.5) * 12 + (k - 1.5) * 3; a.lineTo(x, y); } a.stroke(); }
    ridge(a, R, 210, 30, 20, th.far, W, H);
    for (let i = 0; i < 22; i++) { const x = R() * W, h = 60 + R() * 120, wd = 6 + R() * 12; b.fillStyle = th.mid; b.beginPath(); b.moveTo(x - wd, H); b.lineTo(x - 2, H - h); b.lineTo(x + 3, H - h + 10); b.lineTo(x + wd, H); b.fill(); }
    for (let i = 0; i < 40; i++) rect(b, R() * W, 200 + R() * 70, 1, 1, '#ff6a2a');
  }
  return { far, mid };
}

// ---------- level prerender ----------
function prerender(L) {
  const th = THEMES[L.world], c = mkCanvas(L.w * TILE, L.h * TILE), g = c.getContext('2d');
  const R = rng(L.w * 31 + L.world), lights = [];
  const solidish = (x, y) => { const t = tileAt(L, x, y); return t === T.SOLID || t === T.ICE || t === T.VENT; };
  const airish = (x, y) => { if (y < 0) return true; const t = tileAt(L, x, y); return t === T.AIR || t === T.ONEWAY || t === T.SPIKEUP || t === T.SPIKEDN; };
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const t = L.grid[y * L.w + x], px = x * 16, py = y * 16;
    if (t === T.SOLID || t === T.VENT) {
      const up = !airish(x, y - 1) || y === 0, deep = solidish(x, y - 1) && solidish(x, y - 2) && solidish(x - 1, y) && solidish(x + 1, y);
      rect(g, px, py, 16, 16, deep ? th.deep : th.body);
      for (let k = 0; k < 5; k++) rect(g, px + Math.floor(R() * 14), py + Math.floor(R() * 14), 2 + Math.floor(R() * 3), 1, deep ? th.edge : th.deep);
      if (L.world === 2 && !deep && R() < 0.5) { rect(g, px + 2, py + 2, 1, 1, th.topHi); rect(g, px + 13, py + 2, 1, 1, th.topHi); rect(g, px + 2, py + 13, 1, 1, th.topHi); rect(g, px + 13, py + 13, 1, 1, th.topHi); }
      if (!up) {
        rect(g, px, py, 16, 4, th.top); rect(g, px, py, 16, 1, th.topHi);
        for (let i = 0; i < 16; i += 2) if (R() < 0.55) rect(g, px + i, py + 4, 2, 1 + Math.floor(R() * 3), th.top);
      }
      if (!solidish(x - 1, y) && airish(x - 1, y)) rect(g, px, py, 1, 16, th.edge);
      if (!solidish(x + 1, y) && airish(x + 1, y)) rect(g, px + 15, py, 1, 16, th.edge);
      if (airish(x, y + 1) && y < L.h - 1) rect(g, px, py + 14, 16, 2, th.edge);
      if (t === T.VENT) {
        rect(g, px, py, 16, 5, '#2b1a14'); for (let i = 1; i < 16; i += 3) rect(g, px + i, py + 1, 1, 3, '#ff7a2a');
      }
    } else if (t === T.ICE) {
      rect(g, px, py, 16, 16, '#8fc0e6'); rect(g, px, py, 16, 2, '#f4fbff'); rect(g, px, py + 2, 16, 1, '#c6e6fb');
      for (let i = 0; i < 3; i++) { const sx = Math.floor(R() * 12); rect(g, px + sx, py + 5 + i * 3, 3, 1, '#d6efff'); }
      rect(g, px, py + 15, 16, 1, '#5d8fb8');
    } else if (t === T.ONEWAY) {
      rect(g, px, py, 16, 5, th.plat); rect(g, px, py, 16, 1, th.platHi); rect(g, px, py + 5, 16, 1, th.edge);
      if (tileAt(L, x - 1, y) !== T.ONEWAY) { rect(g, px + 2, py + 5, 2, 4, th.plat); }
      if (tileAt(L, x + 1, y) !== T.ONEWAY) { rect(g, px + 12, py + 5, 2, 4, th.plat); }
      if (L.world === 2) { rect(g, px + 7, py + 2, 2, 1, th.edge); }
      if (L.world === 0) rect(g, px + Math.floor(R() * 12), py + 2, 3, 1, '#5e3f25');
    } else if (t === T.SPIKEUP || t === T.SPIKEDN) {
      const up = t === T.SPIKEUP;
      for (let i = 0; i < 3; i++) {
        const sx = px + 1 + i * 5;
        g.fillStyle = th.spike; g.beginPath();
        if (up) { g.moveTo(sx, py + 16); g.lineTo(sx + 2.5, py + 7); g.lineTo(sx + 5, py + 16); }
        else { g.moveTo(sx, py); g.lineTo(sx + 2.5, py + 9); g.lineTo(sx + 5, py); }
        g.fill();
        rect(g, sx + 2, up ? py + 9 : py + 2, 1, 5, th.edge);
      }
    }
    // decorations on surfaces
    if ((t === T.SOLID || t === T.ICE) && airish(x, y - 1) && tileAt(L, x, y - 1) === T.AIR && y > 0) decoTop(g, L.world, px, py, R, lights);
    if (t === T.SOLID && tileAt(L, x, y + 1) === T.AIR && y < L.h - 2 && R() < 0.35) decoUnder(g, L.world, px, py + 16, R);
  }
  L.canvas = c; L.lights = lights;
  L.lavaTops = [];
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.grid[y * L.w + x] === T.LAVA && tileAt(L, x, y - 1) !== T.LAVA) L.lavaTops.push([x, y]);
}
function decoTop(g, w, px, py, R, lights) {
  const r = R();
  if (w === 0) {
    if (r < 0.5) for (let i = 0; i < 3; i++) { const x = px + 2 + Math.floor(R() * 12), h = 2 + Math.floor(R() * 4); rect(g, x, py - h, 1, h, R() < 0.5 ? '#6fb046' : '#4a8236'); }
    else if (r < 0.58) { rect(g, px + 7, py - 4, 1, 4, '#4a8236'); rect(g, px + 6, py - 6, 3, 2, R() < 0.5 ? '#f2a6c4' : '#ffe27a'); }
    else if (r < 0.64) { rect(g, px + 6, py - 3, 2, 3, '#d8d0bc'); rect(g, px + 4, py - 6, 6, 3, '#6ee0d0'); rect(g, px + 5, py - 7, 4, 1, '#a8fff2'); lights.push({ x: px + 7, y: py - 5, r: 22 }); }
  } else if (w === 1) {
    if (r < 0.14) {
      const col = R() < 0.5 ? ['#3fb6e0', '#a8f0ff'] : ['#a04ad0', '#f0a8ff'];
      for (let i = 0; i < 3; i++) { const x = px + 3 + i * 4, h = 4 + Math.floor(R() * 7); g.fillStyle = col[0]; g.beginPath(); g.moveTo(x - 2, py); g.lineTo(x, py - h); g.lineTo(x + 2, py); g.fill(); rect(g, x, py - h + 2, 1, h - 3, col[1]); }
      lights.push({ x: px + 8, y: py - 5, r: 34 });
    } else if (r < 0.4) rect(g, px + Math.floor(R() * 12), py - 1, 3, 1, '#4a3d6e');
  } else if (w === 2) {
    if (r < 0.06) { rect(g, px + 7, py - 14, 2, 14, '#3a3a40'); rect(g, px + 5, py - 18, 6, 5, '#262628'); rect(g, px + 6, py - 17, 4, 3, '#ffd27a'); lights.push({ x: px + 8, y: py - 16, r: 40 }); }
    else if (r < 0.25) { rect(g, px + 3, py - 2, 10, 2, '#5d4a34'); rect(g, px + 5, py - 3, 2, 1, '#8d7a5a'); }
  } else if (w === 3) {
    if (r < 0.4) { rect(g, px + 2, py - 2, 12, 2, '#ffffff'); rect(g, px + 4, py - 3, 6, 1, '#ffffff'); }
    else if (r < 0.48) { for (let k = 0; k < 3; k++) { g.fillStyle = '#2e5a4e'; g.beginPath(); g.moveTo(px + 2 + k, py - 2 - k * 4); g.lineTo(px + 8, py - 10 - k * 4); g.lineTo(px + 14 - k, py - 2 - k * 4); g.fill(); rect(g, px + 3 + k, py - 3 - k * 4, 10 - 2 * k, 1, '#ffffff'); } }
  } else {
    if (r < 0.18) { rect(g, px + 3 + Math.floor(R() * 8), py - 1, 4, 1, '#ff6a2a'); lights.push({ x: px + 8, y: py, r: 16 }); }
    else if (r < 0.32) { rect(g, px + 5, py - 6, 1, 6, '#1a1010'); rect(g, px + 3, py - 5, 2, 1, '#1a1010'); rect(g, px + 6, py - 4, 3, 1, '#1a1010'); }
  }
}
function decoUnder(g, w, px, py, R) {
  if (w === 0) { const n = 1 + Math.floor(R() * 2); for (let i = 0; i < n; i++) rect(g, px + 2 + Math.floor(R() * 12), py, 1, 3 + Math.floor(R() * 8), '#3c6a2c'); }
  else if (w === 1 || w === 3) { const x = px + 3 + Math.floor(R() * 10), h = 3 + Math.floor(R() * 6); g.fillStyle = w === 1 ? '#3a2e58' : '#d8ecff'; g.beginPath(); g.moveTo(x - 2, py); g.lineTo(x, py + h); g.lineTo(x + 2, py); g.fill(); }
  else if (w === 2) { const x = px + 4 + Math.floor(R() * 8); for (let k = 0; k < 4; k++) rect(g, x, py + k * 3, 2, 2, '#4d4f56'); }
  else { rect(g, px + Math.floor(R() * 14), py, 1, 2, '#ff6a2a'); }
}

// ---------- lighting ----------
let lightCanvas = null, lightCtx = null;
function drawLighting(g, world, lights, camX, boost) {
  if (!lightCanvas) { lightCanvas = mkCanvas(VW, VH); lightCtx = lightCanvas.getContext('2d'); }
  const l = lightCtx, d = THEMES[world].dark;
  const alpha = Math.max(0, Math.min(0.95, d[3] + (boost || 0)));
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, VW, VH);
  l.fillStyle = `rgba(${d[0]},${d[1]},${d[2]},${alpha})`;
  l.fillRect(0, 0, VW, VH);
  l.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const x = L.x - camX, y = L.y;
    if (x < -L.r || x > VW + L.r) continue;
    const gr = l.createRadialGradient(x, y, 0, x, y, L.r);
    gr.addColorStop(0, `rgba(0,0,0,${L.a || 1})`); gr.addColorStop(0.5, `rgba(0,0,0,${(L.a || 1) * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = gr; l.fillRect(x - L.r, y - L.r, L.r * 2, L.r * 2);
  }
  g.drawImage(lightCanvas, 0, 0);
}
function warmGlow(g, x, y, r, a, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col || '255,150,60'},${a})`); gr.addColorStop(1, `rgba(${col || '255,150,60'},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
