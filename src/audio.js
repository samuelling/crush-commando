// ===================== AUDIO: synthesized SFX + procedural music =====================
const AU = { ctx: null, master: null, music: null, sfx: null, lead: null, noiseBuf: null, song: null, songKey: '', nextT: 0, step: 0, timer: null, musicOn: true, sfxOn: true };

function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = new C(); AU.ctx = ctx;
    AU.master = ctx.createGain(); AU.master.gain.value = 0.7; AU.master.connect(ctx.destination);
    AU.music = ctx.createGain(); AU.music.gain.value = AU.musicOn ? 0.3 : 0; AU.music.connect(AU.master);
    AU.sfx = ctx.createGain(); AU.sfx.gain.value = AU.sfxOn ? 0.55 : 0; AU.sfx.connect(AU.master);
    // lead bus with echo
    AU.lead = ctx.createGain(); AU.lead.gain.value = 1; AU.lead.connect(AU.music);
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    AU.lead.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(AU.music);
    const len = ctx.sampleRate * 1;
    AU.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = AU.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.timer = setInterval(musicTick, 25);
    if (AU.songKey) { const k = AU.songKey; AU.songKey = ''; playSong(k); }
  } catch (e) { AU.ctx = null; }
}
function setMusicOn(on) { AU.musicOn = on; if (AU.music) AU.music.gain.setTargetAtTime(on ? 0.3 : 0, AU.ctx.currentTime, 0.05); }
function setSfxOn(on) { AU.sfxOn = on; if (AU.sfx) AU.sfx.gain.setTargetAtTime(on ? 0.55 : 0, AU.ctx.currentTime, 0.05); }

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(f, t, dur, type, vol, dest, o) {
  const c = AU.ctx; if (!c) return;
  o = o || {};
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideT || dur));
  if (o.detune) osc.detune.value = o.detune;
  const a = o.a || 0.005, r = o.r || dur * 0.8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
  node.connect(g); g.connect(dest || AU.sfx);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(t, dur, vol, freq, type, dest, sweep) {
  const c = AU.ctx; if (!c) return;
  const s = c.createBufferSource(); s.buffer = AU.noiseBuf;
  const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
let emberPitch = 0, emberPitchT = 0;
function sfx(name, arg) {
  const c = AU.ctx; if (!c || !AU.sfxOn) return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'jump': tone(330, t, 0.1, 'square', 0.07, null, { slide: 620, lp: 2400 }); break;
    case 'dj': tone(520, t, 0.14, 'triangle', 0.14, null, { slide: 1040 }); tone(1040, t + 0.04, 0.1, 'sine', 0.05); break;
    case 'dash': noise(t, 0.18, 0.35, 3000, 'bandpass', null, 500); tone(160, t, 0.15, 'sawtooth', 0.06, null, { slide: 80, lp: 900 }); break;
    case 'land': noise(t, 0.07, 0.18, 500); break;
    case 'wall': noise(t, 0.05, 0.12, 1800, 'bandpass'); tone(420, t, 0.06, 'square', 0.04, null, { slide: 700 }); break;
    case 'ember': {
      if (t - emberPitchT > 0.6) emberPitch = 0; emberPitchT = t; emberPitch = Math.min(emberPitch + 1, 10);
      const m = 84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24][emberPitch];
      tone(mtof(m), t, 0.07, 'square', 0.045, null, { lp: 5000 }); tone(mtof(m + 7), t + 0.04, 0.09, 'sine', 0.06); break;
    }
    case 'star': [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(mtof(76 + n), t + i * 0.06, 0.3, 'triangle', 0.1)); break;
    case 'stomp': tone(240, t, 0.12, 'square', 0.12, null, { slide: 70, lp: 1500 }); noise(t, 0.08, 0.2, 1200); break;
    case 'hurt': tone(320, t, 0.25, 'sawtooth', 0.12, null, { slide: 90, lp: 1400 }); noise(t, 0.15, 0.2, 900); break;
    case 'die': tone(600, t, 0.7, 'triangle', 0.16, null, { slide: 50 }); noise(t + 0.1, 0.6, 0.25, 700, 'lowpass', null, 150); break;
    case 'check': [0, 7, 12, 16].forEach((n, i) => tone(mtof(67 + n), t + i * 0.07, 0.45, 'triangle', 0.11)); noise(t, 0.4, 0.15, 3000, 'highpass'); break;
    case 'spring': tone(220, t, 0.22, 'sine', 0.2, null, { slide: 880 }); tone(440, t, 0.15, 'square', 0.04, null, { slide: 1200, lp: 2000 }); break;
    case 'break': noise(t, 0.3, 0.4, 1600, 'lowpass', null, 200); tone(120, t, 0.2, 'square', 0.08, null, { slide: 50, lp: 600 }); break;
    case 'crumble': noise(t, 0.12, 0.08, 900); break;
    case 'shoot': tone(700, t, 0.09, 'square', 0.04, null, { slide: 260, lp: 2200 }); break;
    case 'bosshit': noise(t, 0.35, 0.5, 2500, 'lowpass', null, 200); tone(180, t, 0.3, 'square', 0.15, null, { slide: 60, lp: 1200 }); tone(90, t, 0.4, 'sine', 0.3, null, { slide: 40 }); break;
    case 'boom': noise(t, 0.6, 0.5, 1200, 'lowpass', null, 80); tone(70, t, 0.5, 'sine', 0.35, null, { slide: 30 }); break;
    case 'roar': tone(110, t, 0.8, 'sawtooth', 0.12, null, { slide: 55, lp: 700 }); noise(t, 0.8, 0.2, 600, 'bandpass', null, 200); break;
    case 'beacon': [0, 4, 7, 11, 14, 19, 24].forEach((n, i) => tone(mtof(60 + n), t + i * 0.09, 1.6, 'triangle', 0.08, null, { a: 0.03 })); noise(t, 1.5, 0.15, 400, 'lowpass', null, 4000); break;
    case 'heart': [0, 7, 12].forEach((n, i) => tone(mtof(79 + n), t + i * 0.05, 0.2, 'sine', 0.12)); break;
    case 'ui': tone(880, t, 0.05, 'square', 0.04, null, { lp: 3000 }); break;
    case 'ok': tone(660, t, 0.08, 'square', 0.05, null, { lp: 3000 }); tone(990, t + 0.06, 0.12, 'square', 0.05, null, { lp: 3000 }); break;
    case 'telegraph': tone(1200, t, 0.12, 'sine', 0.06); tone(1500, t + 0.1, 0.12, 'sine', 0.06); break;
    case 'zap': tone(1100, t, 0.09, 'square', 0.045, null, { slide: 380, lp: 3200 }); noise(t, 0.06, 0.12, 4000, 'bandpass'); break;
    case 'portal': noise(t, 0.7, 0.3, 300, 'bandpass', null, 3000); [0, 7, 12, 19].forEach((n, i) => tone(mtof(62 + n), t + i * 0.05, 0.6, 'sine', 0.08)); break;
    case 'gunN': noise(t, 0.05, 0.16, 2600, 'bandpass'); tone(520, t, 0.05, 'square', 0.035, null, { slide: 180, lp: 2200 }); break;
    case 'gunM': noise(t, 0.04, 0.13, 3000, 'bandpass'); tone(600, t, 0.04, 'square', 0.03, null, { slide: 220, lp: 2400 }); break;
    case 'gunS': noise(t, 0.09, 0.22, 1600, 'bandpass', null, 400); tone(300, t, 0.08, 'sawtooth', 0.04, null, { slide: 90, lp: 1500 }); break;
    case 'gunL': tone(1600, t, 0.16, 'sine', 0.07, null, { slide: 400 }); tone(2400, t, 0.1, 'square', 0.02, null, { slide: 800, lp: 5000 }); break;
    case 'gunF': noise(t, 0.12, 0.1, 700, 'lowpass', null, 1800); break;
    case 'tink': tone(1800, t, 0.03, 'square', 0.02, null, { lp: 5000 }); break;
    case 'powerup': [0, 4, 7, 12, 16].forEach((n, i) => tone(mtof(72 + n), t + i * 0.05, 0.15, 'square', 0.05, null, { lp: 4000 })); break;
    case 'beep': tone(1400, t, 0.07, 'square', 0.05, null, { lp: 4000 }); break;
    case 'alarm': tone(880, t, 0.18, 'sawtooth', 0.06, null, { slide: 600, lp: 2000 }); tone(660, t + 0.2, 0.18, 'sawtooth', 0.06, null, { slide: 440, lp: 2000 }); break;
    case 'bigboom': noise(t, 1.4, 0.7, 2000, 'lowpass', null, 60); tone(60, t, 1.2, 'sine', 0.5, null, { slide: 25 }); tone(110, t, 0.5, 'square', 0.12, null, { slide: 40, lp: 600 }); break;
    case 'whoosh': noise(t, 0.4, 0.25, 400, 'bandpass', null, 2400); break;
  }
}

// ---- music ----
const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
const SONGS = {
  title: { bpm: 70, root: 52, mode: 'minor', prog: [0, 5, 3, 4], lead: 'sine', arp: 'triangle', drums: 0, seed: 3, sparse: true },
  map: { bpm: 88, root: 55, mode: 'major', prog: [0, 3, 5, 4], lead: 'triangle', arp: 'sine', drums: 0, seed: 7, sparse: true },
  w0: { bpm: 100, root: 55, mode: 'major', prog: [0, 5, 3, 4], lead: 'square', arp: 'triangle', drums: 1, seed: 11 },
  w1: { bpm: 84, root: 50, mode: 'dorian', prog: [0, 6, 5, 6], lead: 'sine', arp: 'triangle', drums: 1, seed: 23 },
  w2: { bpm: 116, root: 48, mode: 'mixo', prog: [0, 6, 3, 0], lead: 'square', arp: 'square', drums: 2, seed: 37 },
  w3: { bpm: 92, root: 52, mode: 'minor', prog: [0, 5, 2, 6], lead: 'triangle', arp: 'sine', drums: 1, seed: 41 },
  w4: { bpm: 124, root: 45, mode: 'phryg', prog: [0, 1, 0, 6], lead: 'sawtooth', arp: 'square', drums: 2, seed: 53 },
  boss: { bpm: 144, root: 45, mode: 'harm', prog: [0, 0, 5, 4], lead: 'square', arp: 'sawtooth', drums: 3, seed: 61 },
  final: { bpm: 150, root: 43, mode: 'harm', prog: [0, 5, 1, 4], lead: 'sawtooth', arp: 'square', drums: 3, seed: 77 },
  end: { bpm: 78, root: 55, mode: 'major', prog: [3, 4, 0, 5], lead: 'triangle', arp: 'sine', drums: 0, seed: 91, sparse: true },
};
function buildSong(S) {
  const R = rng(S.seed), sc = MODES[S.mode];
  const deg = d => { const o = Math.floor(d / 7); return S.root + sc[((d % 7) + 7) % 7] + 12 * o; };
  const steps = 64, lead = new Array(steps).fill(null), bass = [], arp = [], chord = [], pad = [];
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / 8), c = S.prog[bar % 4];
    chord.push(c); pad.push([deg(c) - 12, deg(c + 2) - 12, deg(c + 4) - 12]);
    const pos = s % 8;
    bass.push(([0, 3, 4, 6].includes(pos) || (S.drums >= 3 && pos % 2 === 0)) ? deg(c + (pos === 4 ? 4 : 0)) - 24 : null);
    arp.push(deg(c + [0, 2, 4, 2, 7, 4, 2, 4][pos]) + (S.sparse ? 0 : 12));
  }
  const rhythms = S.sparse
    ? [[1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0], [1, 0, 0, 0, 0, 0, 0, 0]]
    : [[1, 0, 1, 0, 1, 1, 0, 1], [1, 0, 0, 1, 0, 0, 1, 0], [1, 1, 0, 1, 0, 1, 1, 0], [1, 0, 1, 1, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 1, 1]];
  const phrase = () => {
    const out = []; let d = 7 + Math.floor(R() * 3);
    for (let b = 0; b < 4; b++) {
      const rh = rhythms[Math.floor(R() * rhythms.length)];
      for (let p = 0; p < 8; p++) {
        if (!rh[p]) { out.push(null); continue; }
        const c = S.prog[b];
        if (p === 0) { const tones = [c + 7, c + 9, c + 11]; d = tones.reduce((a, x) => Math.abs(x - d) < Math.abs(a - d) ? x : a, tones[0]); }
        else d += [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)];
        d = Math.max(4, Math.min(16, d));
        out.push(d);
      }
    }
    return out;
  };
  const A = phrase(), B = phrase();
  const A2 = A.slice(); for (let i = 24; i < 32; i++) A2[i] = B[i];
  const seq = A.concat(R() < 0.5 ? B : A2);
  for (let s = 0; s < steps; s++) lead[s] = seq[s] === null ? null : deg(seq[s]);
  return { S, lead, bass, arp, chord, pad, dur: 60 / S.bpm / 2 };
}
const songCache = {};
function playSong(key) {
  if (AU.songKey === key) return;
  AU.songKey = key;
  if (!AU.ctx) return;
  AU.song = key ? (songCache[key] || (songCache[key] = buildSong(SONGS[key]))) : null;
  AU.step = 0; AU.nextT = AU.ctx.currentTime + 0.1;
}
function musicTick() {
  const c = AU.ctx; if (!c || !AU.song) return;
  const M = AU.song, S = M.S;
  while (AU.nextT < c.currentTime + 0.15) {
    const t = AU.nextT, s = AU.step % 64, d = M.dur;
    if (M.lead[s] !== null) {
      let len = 1; while (len < 4 && M.lead[(s + len) % 64] === null && (s + len) % 8 !== 0) len++;
      tone(mtof(M.lead[s]), t, d * len * 0.95, S.lead, S.lead === 'sawtooth' ? 0.05 : S.lead === 'square' ? 0.06 : 0.12, AU.lead, { lp: S.lead === 'sawtooth' ? 1800 : 3500, a: 0.01, detune: 4 });
    }
    if (M.bass[s] !== null) tone(mtof(M.bass[s]), t, d * 1.8, 'triangle', 0.22, AU.music, { a: 0.01 });
    if (!S.sparse || s % 2 === 0) tone(mtof(M.arp[s]), t, d * (S.sparse ? 3.5 : 0.8), S.arp, S.sparse ? 0.05 : (S.arp === 'sine' || S.arp === 'triangle' ? 0.06 : 0.025), AU.music, { lp: 2600, a: S.sparse ? 0.08 : 0.005 });
    if (S.sparse && s % 16 === 0) {
      M.pad[s].forEach(m => tone(mtof(m), t, d * 15, 'sine', 0.035, AU.music, { a: 0.6, r: d * 8 }));
    }
    if (S.drums >= 1) {
      const p = s % 8;
      if (p === 0 || p === 4 || (S.drums >= 3 && p === 6)) tone(120, t, 0.18, 'sine', 0.35, AU.music, { slide: 45, slideT: 0.12 });
      if (p % 2 === 1) noise(t, 0.04, 0.05, 7000, 'highpass', AU.music);
      if (S.drums >= 2 && (p === 2 || p === 6)) noise(t, 0.12, 0.13, 1800, 'bandpass', AU.music);
      if (S.drums >= 3 && p % 2 === 0) noise(t, 0.03, 0.04, 9000, 'highpass', AU.music);
    }
    AU.nextT += d; AU.step++;
  }
}
