// ===================== BELL: first-person music, ported from bellweather =====================
// A WebAudio port of Engine_WeatherBell and bellweather.lua (samuelling/bellweather, a norns script):
// - drone: two sub octaves and a root (mostly sine with a little saw), two clean sine octaves and a
//   bell partial (x2.76) that open up by day and fold away at night, each swelling on its own slow,
//   unsynchronised cycle, through a resonant low-pass whose sweep rate follows the wind
// - pink-noise rain texture, wind (band-passed noise on a drifting random walk, stochastic gusts with
//   a thin whistle, through a comb delay), and rare moon-phase throbs in the subs
// - Karplus-Strong plucks (two strings a hair apart, piano-like two-stage envelope): snappy for rain,
//   soft and long for snow, density and loudness following the chance of rain
// - the melody walks like bellweather's: mostly steps, leap recovery, a pull back to the centre
// - a six-partial deep bell (hum, prime, tierce, quint, nominal, clang) when you enter a 3D zone
// - drone drift: the root wanders by scale steps or octaves and glides there (humidity sets the glide)
// Out through reverb + 375 ms delay, like WeatherBellOut. Time constants are sped up (TS) because a
// first-person stretch lasts a minute, not an evening.
const BELL = { nodes: null, on: false, deg: 0, last: 0, drift: 0, nextNote: 0.6, nextDrift: 8, nextBell: 0, gust: 0, windWalk: 0, songWas: '', ks: new Map() };
const BELL_TS = 5;
const BELL_ROOT = 55;   // A1, bellweather's default root
const BELL_SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 3, 5, 7, 9, 10], [0, 2, 3, 5, 7, 8, 10], [0, 2, 4, 6, 8, 10]];   // per world: major pent, minor pent, dorian, natural minor, whole tone
const BELL_STEPS = [0.5, 0.67, 0.75, 1.0, 1.0, 1.0, 1.33, 1.5, 2.0];
const linlin = (v, a, b, c, d) => c + (clamp(v, Math.min(a, b), Math.max(a, b)) - a) / (b - a) * (d - c);

function bellWeather() {
  const live = WX.live && !SAVE.wxOff;
  const temp = live ? WX.temp : 60, wind = live ? WX.wind : 3, hum = live ? WX.hum : 50;
  const wet = Math.max(WX.rain, WX.snow);
  // like bellweather, the chance of rain sets the melody; a light drizzle of notes even on a dry day
  const precip = live ? Math.max(0.3, WX.prob / 100, wet ? 0.55 + wet * 0.45 : 0) : 0.35;
  return { temp, wind, hum, precip, snow: live && (WX.snow > 0 || temp <= 32), day: SAVE.wxOff ? 0.5 : wxDaytimeFactor(), moon: wxMoon() };
}

function bellNoiseBuf(c, pink) {
  const n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) { d[i] = w; continue; }
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return b;
}
function bellImpulse(c, secs) {
  const n = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}

function bellBuild() {
  const c = AU.ctx, N = {};
  N.out = c.createGain(); N.out.gain.value = 0; N.out.connect(AU.music);
  // output stage: dry + (reverb, 375 ms delay)
  N.fx = c.createGain();
  const dry = c.createGain(); dry.gain.value = 0.62; N.fx.connect(dry); dry.connect(N.out);
  const verb = c.createConvolver(); verb.buffer = bellImpulse(c, 3.4);
  const vg = c.createGain(); vg.gain.value = 0.36; N.fx.connect(verb); verb.connect(vg); vg.connect(N.out);
  const dl = c.createDelay(1); dl.delayTime.value = 0.375; const fb = c.createGain(); fb.gain.value = 0.36; const dg = c.createGain(); dg.gain.value = 0.22;
  N.fx.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(dg); dg.connect(N.out);
  // drone filter (RLPF) with its slow sweep
  N.filt = c.createBiquadFilter(); N.filt.type = 'lowpass'; N.filt.frequency.value = 1400; N.filt.connect(N.fx);
  N.lfo = c.createOscillator(); N.lfo.frequency.value = 0.02 * BELL_TS; N.lfoG = c.createGain(); N.lfoG.gain.value = 400; N.lfo.connect(N.lfoG); N.lfoG.connect(N.filt.frequency); N.lfo.start();
  // drone layers: [ratio, sine share, saw share, swell rate, swell low]
  const L = [[0.25, 0.8, 0.2, 0.009, 0.8], [0.5, 0.8, 0.2, 0.013, 0.8], [1, 0.75, 0.25, 0.017, 0.85], [2, 1, 0, 0.021, 0.75], [4, 1, 0, 0.026, 0.7], [2.76, 1, 0, 0, 1]];
  N.layers = L.map(([ratio, sn, sw, rate, lo]) => {
    const lvl = c.createGain(); lvl.gain.value = 0; lvl.connect(N.filt);
    const swell = c.createGain(); swell.gain.value = (1 + lo) / 2; swell.connect(lvl);
    const oscs = [];
    for (const [type, share] of [['sine', sn], ['sawtooth', sw]]) {
      if (!share) continue;
      const o = c.createOscillator(); o.type = type; o.frequency.value = BELL_ROOT * ratio;
      const g = c.createGain(); g.gain.value = share; o.connect(g); g.connect(swell); o.start(); oscs.push(o);
    }
    let lf = null;
    if (rate) { lf = c.createOscillator(); lf.frequency.value = rate * BELL_TS; const lg = c.createGain(); lg.gain.value = (1 - lo) / 2; lf.connect(lg); lg.connect(swell.gain); lf.start(); }
    return { ratio, lvl, swell, oscs, lf, rate };
  });
  // rain texture
  const pink = bellNoiseBuf(c, true), white = bellNoiseBuf(c, false);
  N.noise = c.createGain(); N.noise.gain.value = 0;
  const ns = c.createBufferSource(); ns.buffer = pink; ns.loop = true; ns.connect(N.noise); N.noise.connect(N.filt); ns.start();
  // wind: drifting band-pass body + gust whistle, through a comb delay
  N.wind = c.createGain(); N.wind.gain.value = 0;
  N.windBP = c.createBiquadFilter(); N.windBP.type = 'bandpass'; N.windBP.frequency.value = 400; N.windBP.Q.value = 0.77;
  const ws = c.createBufferSource(); ws.buffer = pink; ws.loop = true; ws.loopStart = 1.7; ws.connect(N.windBP);
  const body = c.createGain(); body.gain.value = 0.8; N.windBP.connect(body); body.connect(N.wind); ws.start(0, 1.7);
  const wh = c.createBufferSource(); wh.buffer = white; wh.loop = true; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
  N.whistle = c.createGain(); N.whistle.gain.value = 0; wh.connect(hp); hp.connect(N.whistle); N.whistle.connect(N.wind); wh.start();
  const comb = c.createDelay(1); comb.delayTime.value = 0.42; const cfb = c.createGain(); cfb.gain.value = 0.5; const cg = c.createGain(); cg.gain.value = 0.5;
  N.wind.connect(comb); comb.connect(cfb); cfb.connect(comb); comb.connect(cg);
  const wmix = c.createGain(); wmix.gain.value = 0.65; N.wind.connect(wmix); wmix.connect(N.filt); cg.connect(N.filt);
  BELL.nodes = N;
}

// ---- voices ----
// Karplus-Strong, rendered into a buffer: two strings (f, f*1.003) excited by a noise burst
function bellKS(freq, snow) {
  const key = Math.round(freq * 10) + (snow ? 's' : 'r');
  if (BELL.ks.has(key)) return BELL.ks.get(key);
  const c = AU.ctx, sr = c.sampleRate, decay = snow ? 2.8 : 0.5, coef = snow ? 0.22 : 0.1, strike = snow ? 0.09 : 0.002;
  const n = Math.ceil(sr * (decay + 0.1)), buf = c.createBuffer(1, n, sr), out = buf.getChannelData(0);
  const burst = new Float32Array(Math.ceil(sr * (strike + 0.002)));
  for (let i = 0; i < burst.length; i++) { const t = i / sr, env = t < 0.0005 ? t / 0.0005 : Math.pow(Math.max(0, 1 - (t - 0.0005) / strike), 4); burst[i] = (Math.random() * 2 - 1) * env; }
  for (const [f, dec, w] of [[freq, decay, 0.7], [freq * 1.003, decay * 0.92, 0.5]]) {
    const D = sr / f, len = Math.ceil(D) + 2, line = new Float32Array(len), g = Math.pow(0.001, 1 / (dec * f));
    let wi = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const rp = wi - D, i0 = Math.floor(rp), fr = rp - i0;
      const a = line[((i0 % len) + len) % len], b = line[(((i0 + 1) % len) + len) % len];
      lp = (1 - Math.abs(coef)) * (a + (b - a) * fr) + coef * lp;
      const y = (i < burst.length ? burst[i] : 0) + g * lp;
      line[wi % len] = y; wi++;
      out[i] += y * w;
    }
  }
  // piano-like envelope: quick dip as the upper partials shed, then a long body; plus a DC blocker
  let x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, a = decay * 0.25;
    const env = t < 0.001 ? t / 0.001 : t < a ? 1 - 0.45 * (1 - Math.pow(1 - (t - 0.001) / a, 3)) : 0.55 * Math.pow(Math.max(0, 1 - (t - a) / (decay * 0.75)), 3);
    const x = out[i] * env, y = x - x1 + 0.995 * y1; x1 = x; y1 = y; out[i] = y;
  }
  if (BELL.ks.size > 120) BELL.ks.clear();
  BELL.ks.set(key, buf);
  return buf;
}
function bellPluck(freq, amp, snow) {
  const c = AU.ctx, s = c.createBufferSource(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
  s.buffer = bellKS(freq, snow); g.gain.value = amp;
  s.connect(g);
  if (p) { p.pan.value = Math.random() * 1.2 - 0.6; g.connect(p); p.connect(BELL.nodes.fx); } else g.connect(BELL.nodes.fx);
  s.start();
}
function bellStrike(freq) {
  const c = AU.ctx, t = c.currentTime;
  for (const [r, dur, a] of [[0.5, 8, 0.4], [1, 6, 0.5], [1.19, 4, 0.3], [1.5, 3, 0.25], [2, 2.5, 0.3], [4.05, 0.4, 0.35]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq * r; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.5, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(BELL.nodes.fx); o.start(t); o.stop(t + dur + 0.05);
  }
}

// ---- melody: bellweather's mutate_degree() ----
function bellMutate() {
  if (Math.random() < 0.15) { BELL.last = 0; return; }
  const r = Math.random(), size = r < 0.65 ? 1 : r < 0.88 ? 2 : 3 + Math.floor(Math.random() * 2);
  let dir;
  if (Math.abs(BELL.last) >= 3 && Math.random() < 0.7) dir = BELL.last > 0 ? -1 : 1;
  else { const toward = BELL.deg > 0 ? -1 : 1, pull = clamp(Math.abs(BELL.deg) / 14, 0, 1) * 0.6; dir = Math.random() < 0.5 + pull ? toward : -toward; }
  BELL.deg = clamp(BELL.deg + dir * size, -14, 14); BELL.last = dir * size;
}
function bellFreq(deg, mult) {
  const sc = BELL_SCALES[G.world] || BELL_SCALES[0], n = sc.length, oct = Math.floor(deg / n), idx = ((deg % n) + n) % n;
  return BELL_ROOT * mult * Math.pow(2, (sc[idx] + oct * 12) / 12);
}

// ---- weather -> sound, every frame while on ----
function bellApply(w) {
  const N = BELL.nodes, c = AU.ctx, t = c.currentTime, set = (p, v, tc) => p.setTargetAtTime(v, t, tc);
  const day = w.day, lane = Math.abs((G.P && G.P.lane) || 0);
  const lvls = [0.35 + (1 - day) * 0.15, 0.35 + (1 - day) * 0.15, 0.35, day * 0.25, day * day * 0.15, 0.04 + day * 0.05];
  N.layers.forEach((L, i) => { set(L.lvl.gain, lvls[i], 1.5); if (L.lf) set(L.lf.frequency, L.rate * BELL_TS * linlin(w.wind, 0, 50, 0.6, 1.7), 2); });
  // deeper hidden lanes sound darker
  set(N.filt.frequency, 1400 * (1 - lane * 0.16), 1.2);
  const res = linlin(w.hum, 0, 100, 0.05, 0.3);
  N.filt.Q.value = 20 * Math.log10(1 / (1 - res));
  set(N.lfo.frequency, linlin(w.wind, 0, 50, 0.006, 0.05) * BELL_TS, 3);
  set(N.noise.gain, linlin(w.precip, 0, 1, 0, 0.3) * 0.5, 2);
  const wn = clamp(w.wind / 50, 0, 1);
  BELL.windWalk = clamp(BELL.windWalk + (Math.random() - 0.5) * 30, -300, 300);
  set(N.windBP.frequency, clamp(250 + wn * 900 + BELL.windWalk + BELL.gust * 2200, 120, 5000), 0.4);
  set(N.whistle.gain, BELL.gust * 0.5, 0.2);
  set(N.wind.gain, (0.12 + wn * 0.6) * linlin(w.wind, 0, 50, 0, 1) * 0.55, 2);
}

function bellStart() {
  if (!AU.ctx) return;
  if (!BELL.nodes) bellBuild();
  BELL.on = true;
  BELL.songWas = AU.songKey; playSong('');
  const N = BELL.nodes, t = AU.ctx.currentTime;
  N.out.gain.cancelScheduledValues(t); N.out.gain.setTargetAtTime(0.6, t, 0.8);
  BELL.nextNote = 0.8; BELL.nextBell = 22;
  bellStrike(BELL_ROOT * 2);
}
function bellStop() {
  if (!BELL.on) return;
  BELL.on = false;
  if (BELL.nodes && AU.ctx) { const t = AU.ctx.currentTime; BELL.nodes.out.gain.cancelScheduledValues(t); BELL.nodes.out.gain.setTargetAtTime(0, t, 0.5); }
  if (G.scene === 'play' && AU.songKey === '' && BELL.songWas) playSong(BELL.songWas);
}

function bellTick(dt) {
  const want = G.scene === 'play' && G.mode === 'fp' && !(G.boss);
  if (want && !BELL.on) bellStart();
  else if (!want && BELL.on) bellStop();
  if (!BELL.on || !BELL.nodes) return;
  const w = bellWeather();
  // gusts: randomly timed, each a quick rise and a slow fall
  if (Math.random() < dt * (0.015 + clamp(w.wind / 50, 0, 1) * 0.08) * BELL_TS) BELL.gust = 1;
  BELL.gust = Math.max(0, BELL.gust - dt / 3.5 * 2);
  bellApply(w);
  // moon throb: rare, slow swells in the subs
  if (Math.random() < dt * (0.0015 + w.moon * 0.012) * BELL_TS * 3) {
    const t = AU.ctx.currentTime;
    for (const L of BELL.nodes.layers.slice(0, 2)) { L.lvl.gain.setTargetAtTime(0.55, t, 2); L.lvl.gain.setTargetAtTime(0.4, t + 4, 3); }
  }
  // melody
  BELL.nextNote -= dt;
  if (BELL.nextNote <= 0) {
    const base = linlin(w.precip, 0.001, 1, 2.5, 0.4), mult = BELL_STEPS[Math.floor(Math.random() * BELL_STEPS.length)];
    BELL.nextNote = base * mult * 0.5;
    const density = linlin(w.precip, 0.001, 1, 0.4, 0.85);
    if (Math.random() < density) { bellMutate(); bellPluck(bellFreq(BELL.deg, 4), 0.28 * linlin(w.precip, 0, 1, 0.5, 1) * 1.6, w.snow); }
  }
  // drone drift: mostly octave moves, sometimes one or two scale steps, gliding there
  BELL.nextDrift -= dt;
  if (BELL.nextDrift <= 0) {
    BELL.nextDrift = Math.max(30, linlin(w.hum, 0, 100, 90, 30)) / BELL_TS * (0.7 + Math.random() * 0.6);
    const n = (BELL_SCALES[G.world] || BELL_SCALES[0]).length;
    const step = Math.random() < 0.5 ? (Math.random() < 0.5 ? n : -n) : (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2));
    BELL.drift = clamp(BELL.drift + step, -n, n);
    const f = bellFreq(BELL.drift, 1), glide = linlin(w.hum, 0, 100, 4, 26) / BELL_TS * 2, t = AU.ctx.currentTime;
    for (const L of BELL.nodes.layers) for (const o of L.oscs) o.frequency.setTargetAtTime(f * L.ratio, t, glide / 3);
  }
  BELL.nextBell -= dt;
  if (BELL.nextBell <= 0) { BELL.nextBell = 24 + Math.random() * 16; bellStrike(bellFreq(BELL.drift, 2)); }
}
