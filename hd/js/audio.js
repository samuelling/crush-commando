// WebAudio synthesized SFX and per-chapter music. No audio files needed.
import { readPref, writePref } from './story.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Each arrangement: 8 bars x 8 eighth notes. `bass` holds one bass note (MIDI) per bar.
const ARR = {
  bright: {
    bpm: 148, bass: [36, 36, 33, 33, 29, 29, 31, 31], bassMode: 'pattern', bassPat: [1, 0, 0, 1, 1, 0, 1, 0],
    lead: [
      72, 0, 76, 0, 79, 76, 0, 72, 74, 0, 72, 0, 69, 0, 0, 0,
      69, 0, 72, 0, 76, 72, 0, 69, 67, 0, 69, 0, 72, 0, 0, 0,
      65, 0, 69, 0, 72, 69, 0, 65, 67, 0, 65, 0, 64, 0, 0, 0,
      67, 0, 71, 0, 74, 71, 0, 67, 72, 0, 74, 0, 76, 0, 79, 0,
    ],
    leadWave: 'square', leadVol: 0.16, hat: 'odd',
  },
  noir: {
    bpm: 96, bass: [45, 45, 41, 41, 38, 38, 40, 40], bassMode: 'walk', walk: [0, 3, 7, 10],
    lead: [
      76, 0, 0, 0, 74, 0, 72, 0, 69, 0, 0, 0, 0, 0, 0, 0,
      72, 0, 0, 74, 72, 0, 69, 0, 65, 0, 0, 0, 0, 0, 0, 0,
      74, 0, 0, 0, 77, 0, 76, 74, 72, 0, 0, 0, 69, 0, 0, 0,
      71, 0, 0, 0, 68, 0, 71, 0, 76, 0, 0, 0, 0, 0, 0, 0,
    ],
    leadWave: 'triangle', leadVol: 0.24, leadLen: 1.8, hat: 'swing',
  },
  swing: {
    bpm: 116, bass: [43, 43, 48, 48, 43, 43, 50, 48], bassMode: 'pattern', bassPat: [1, 0, 0, 1, 0, 0, 1, 0],
    lead: [
      74, 0, 76, 74, 71, 0, 67, 0, 69, 0, 71, 0, 67, 0, 0, 0,
      72, 0, 76, 0, 79, 76, 74, 72, 74, 0, 0, 0, 0, 0, 0, 0,
      74, 0, 76, 74, 71, 0, 67, 0, 69, 0, 71, 0, 74, 0, 0, 0,
      78, 0, 76, 0, 74, 0, 72, 71, 67, 0, 0, 0, 0, 0, 0, 0,
    ],
    leadWave: 'square', leadVol: 0.12, hat: 'odd', clap: true,
  },
  flight: {
    bpm: 132, bass: [36, 40, 41, 43, 36, 40, 41, 43], bassMode: 'pattern', bassPat: [1, 0, 1, 0, 1, 0, 1, 0],
    arp: [0, 4, 7, 12, 16, 12, 7, 4], leadWave: 'square', leadVol: 0.08, hat: 'odd',
  },
  hush: {
    bpm: 132, bass: [36, 40, 41, 43, 36, 40, 41, 43], bassMode: 'long',
    arp: [0, 7, 12, 16, 19, 16, 12, 7], leadWave: 'sine', leadVol: 0.16,
  },
  dream: {
    bpm: 84, bass: [41, 45, 43, 40, 41, 45, 38, 40], bassMode: 'long',
    arp: [0, 7, 12, 14, 19, 14, 12, 7], leadWave: 'sine', leadVol: 0.2,
  },
  lack: { bpm: 66, bass: [38, 38, 38, 38, 38, 38, 38, 38], bassMode: 'drone', ping: true },
  gray: { bpm: 72, bass: [40, 40, 40, 40, 41, 41, 40, 40], bassMode: 'drone', cluster: true },
  arrest: {
    bpm: 84, bass: [36, 36, 41, 41, 43, 43, 36, 36], bassMode: 'pattern', bassPat: [1, 0, 0, 0, 1, 0, 0, 0],
    lead: [
      72, 0, 0, 0, 74, 0, 76, 0, 72, 0, 0, 0, 0, 0, 0, 0,
      77, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0, 0, 0, 0, 0,
      74, 0, 0, 0, 76, 0, 77, 0, 79, 0, 0, 0, 0, 0, 0, 0,
      77, 0, 76, 0, 74, 0, 71, 0, 72, 0, 0, 0, 0, 0, 0, 0,
    ],
    leadWave: 'triangle', leadVol: 0.22, leadLen: 1.6, hat: 'odd',
  },
  fight: {
    bpm: 136, bass: [38, 38, 41, 41, 36, 36, 40, 40], bassMode: 'pattern', bassPat: [1, 0, 1, 1, 1, 0, 1, 1],
    lead: [
      74, 0, 0, 77, 0, 0, 74, 0, 72, 0, 0, 0, 69, 0, 0, 0,
      77, 0, 0, 81, 0, 0, 77, 0, 76, 0, 0, 0, 72, 0, 0, 0,
      72, 0, 0, 76, 0, 0, 72, 0, 71, 0, 0, 0, 67, 0, 0, 0,
      76, 0, 0, 79, 0, 0, 76, 0, 74, 0, 72, 0, 71, 0, 0, 0,
    ],
    leadWave: 'square', leadVol: 0.1, hat: 'odd', clap: true,
  },
  mind: {
    bpm: 72, bass: [38, 41, 45, 43, 38, 41, 36, 40], bassMode: 'long',
    arp: [0, 7, 12, 16, 19, 16, 12, 7], leadWave: 'sine', leadVol: 0.17, hat: 'type',
  },
  collage: { collage: ['bright', 'noir', 'swing', 'dream', 'arrest', 'flight'] },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = readPref('hd_muted', '0') === '1';
    this._timer = null;
    this._next = 0;
    this._step = 0;
    this._bar = 0;
    this.arrName = 'bright';
    this.pending = null;
    this.layers = { lead: true, bass: true, perc: true };
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // a gentle limiter lets everything sit louder without clipping on small speakers
      const limit = this.ctx.createDynamicsCompressor();
      limit.threshold.value = -12; limit.knee.value = 8; limit.ratio.value = 6;
      limit.attack.value = 0.004; limit.release.value = 0.2;
      limit.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(limit);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.mus = this.ctx.createGain();
      this.mus.gain.value = 0.6;
      this.mus.connect(this.master);
      this.ctx.addEventListener('statechange', () => { if (this.ctx.state === 'interrupted') this.ctx.resume().catch(() => {}); });
    }
    // iOS mutes Web Audio with the ringer switch unless the page is playing "media"
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* unsupported */ }
    if (!navigator.audioSession && /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) this.mediaKeepAlive();
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  // Tab hidden: go quiet (and release the media session) until the next tap.
  sleep() {
    if (this._silent) this._silent.pause();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  // Older iOS: a silent looping <audio> element switches the page into the playback category.
  mediaKeepAlive() {
    if (this._silent) { if (this._silent.paused) this._silent.play().catch(() => {}); return; }
    const rate = 8000, n = rate / 4, b = new DataView(new ArrayBuffer(44 + n));
    const str = (o, t) => { for (let i = 0; i < t.length; i++) b.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); b.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true);
    b.setUint16(20, 1, true); b.setUint16(22, 1, true); b.setUint32(24, rate, true); b.setUint32(28, rate, true);
    b.setUint16(32, 1, true); b.setUint16(34, 8, true); str(36, 'data'); b.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
    const a = document.createElement('audio');
    a.src = URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }));
    a.loop = true; a.setAttribute('playsinline', ''); a.setAttribute('x-webkit-airplay', 'deny');
    this._silent = a;
    a.play().catch(() => {});
  }

  // Bass notes also get a soft octave-up square so the line survives phone speakers.
  bass(f0, { type = 'triangle', dur, vol, delay, attack = 0.004, presence = 0.32 }) {
    this.tone({ f0, type, dur, vol, delay, dest: this.mus, attack });
    if (presence) this.tone({ f0: f0 * 2, type: 'square', dur, vol: vol * presence, delay, dest: this.mus, attack });
  }

  setMuted(m) {
    this.muted = m;
    writePref('hd_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  setArrangement(name) {
    if (!ARR[name] || name === this.arrName) { this.pending = null; return; }
    if (this._timer) this.pending = name; else this.arrName = name;
  }

  setLayers(l) { this.layers = { lead: true, bass: true, perc: true, ...l }; }

  tone({ f0, f1 = f0, type = 'square', dur = 0.1, vol = 0.3, delay = 0, dest = null, attack = 0.004 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.max(0, delay);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest || this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur = 0.1, vol = 0.2, delay = 0, { dest = null, type = 'bandpass', freq = 900 } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.max(0, delay);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(g).connect(dest || this.sfx);
    src.start(t);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone({ f0: 320, f1: 640, dur: 0.12, vol: 0.22 }); break;
      case 'djump': this.tone({ f0: 420, f1: 980, dur: 0.15, vol: 0.22 }); this.tone({ f0: 630, f1: 1260, dur: 0.12, vol: 0.12, delay: 0.03 }); break;
      case 'land': this.noise(0.05, 0.12); break;
      case 'coin': this.tone({ f0: 988, dur: 0.06, vol: 0.18 }); this.tone({ f0: 1319, dur: 0.16, vol: 0.18, delay: 0.06 }); break;
      case 'stomp': this.tone({ f0: 260, f1: 60, dur: 0.16, vol: 0.3 }); this.noise(0.12, 0.2); break;
      case 'hurt': this.tone({ f0: 220, f1: 70, type: 'sawtooth', dur: 0.3, vol: 0.3 }); this.noise(0.15, 0.2); break;
      case 'fall': this.tone({ f0: 500, f1: 90, type: 'triangle', dur: 0.6, vol: 0.3 }); break;
      case 'checkpoint': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f0: f, dur: 0.12, vol: 0.2, delay: i * 0.07 })); break;
      case 'chapter': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ f0: f, type: 'triangle', dur: 0.5, vol: 0.18, delay: i * 0.11, attack: 0.02 })); break;
      case 'heart': [659, 784, 988, 1319].forEach((f, i) => this.tone({ f0: f, type: 'triangle', dur: 0.14, vol: 0.25, delay: i * 0.08 })); break;
      case 'ring': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone({ f0: f, type: 'sine', dur: 0.6, vol: 0.16, delay: i * 0.06, attack: 0.01 })); break;
      case 'bounce': this.tone({ f0: 180, f1: 720, type: 'sine', dur: 0.22, vol: 0.32 }); break;
      case 'swallow': this.tone({ f0: 600, f1: 40, type: 'sine', dur: 0.9, vol: 0.35 }); break;
      case 'crumble': this.noise(0.5, 0.35, 0, { type: 'lowpass', freq: 400 }); this.tone({ f0: 90, f1: 40, type: 'sawtooth', dur: 0.4, vol: 0.18 }); break;
      case 'rumble': this.noise(0.35, 0.18, 0, { type: 'lowpass', freq: 220 }); break;
      case 'vase': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ f0: f, type: 'sine', dur: 0.9, vol: 0.12, delay: i * 0.12, attack: 0.03 })); break;
      case 'select': this.tone({ f0: 880, dur: 0.06, vol: 0.15 }); this.tone({ f0: 1320, dur: 0.08, vol: 0.12, delay: 0.05 }); break;
      case 'word': this.noise(0.03, 0.4, 0, { type: 'bandpass', freq: 2400 }); this.tone({ f0: 1300, f1: 900, dur: 0.05, vol: 0.06 }); break;
      case 'ding': [1568, 2093].forEach((f, i) => this.tone({ f0: f, type: 'sine', dur: 1.4, vol: 0.2 - i * 0.08, delay: i * 0.02, attack: 0.005 })); break;
      case 'erase': this.noise(0.45, 0.3, 0, { type: 'highpass', freq: 1800 }); this.tone({ f0: 700, f1: 120, type: 'triangle', dur: 0.45, vol: 0.18 }); break;
      case 'page': this.noise(0.3, 0.3, 0, { type: 'bandpass', freq: 1100 }); this.tone({ f0: 392, type: 'triangle', dur: 0.8, vol: 0.15, delay: 0.1, attack: 0.03 }); break;
      case 'gameover': [440, 415, 392, 349].forEach((f, i) => this.tone({ f0: f, f1: f * 0.98, type: 'sawtooth', dur: 0.28, vol: 0.22, delay: i * 0.22 })); break;
      case 'start': [523, 659, 784].forEach((f, i) => this.tone({ f0: f, dur: 0.1, vol: 0.2, delay: i * 0.06 })); break;
    }
  }

  startMusic() {
    if (!this.ctx || this._timer) return;
    this._next = this.ctx.currentTime + 0.05;
    this._step = 0;
    this._timer = setInterval(() => this._schedule(), 60);
  }

  stopMusic() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  _arr() {
    const A = ARR[this.arrName] || ARR.bright;
    return A.collage ? ARR[A.collage[this._bar % A.collage.length]] : A;
  }

  _schedule() {
    if (!this.ctx) return;
    while (this._next < this.ctx.currentTime + 0.25) {
      if (this._step % 8 === 0) {
        this._bar++;
        if (this.pending) { this.arrName = this.pending; this.pending = null; }
      }
      const A = this._arr();
      const stepDur = 60 / A.bpm / 2;
      this._playStep(A, this._step, this._next - this.ctx.currentTime, stepDur);
      this._step = (this._step + 1) % 64;
      this._next += stepDur;
    }
  }

  _playStep(A, step, delay, stepDur) {
    if (this.muted) return;
    const bar = Math.floor(step / 8), beat = step % 8;
    const root = A.bass[bar];
    const L = this.layers, mus = this.mus;
    if (L.bass) {
      if (A.bassMode === 'pattern' && A.bassPat[beat]) {
        this.bass(midi(root), { dur: stepDur * 0.9, vol: 0.5, delay });
      } else if (A.bassMode === 'walk' && beat % 2 === 0) {
        this.bass(midi(root + A.walk[beat / 2]), { dur: stepDur * 1.8, vol: 0.45, delay });
      } else if (A.bassMode === 'long' && beat === 0) {
        this.bass(midi(root), { type: 'sine', dur: stepDur * 7.5, vol: 0.4, delay, attack: 0.05, presence: 0.26 });
      } else if (A.bassMode === 'drone' && beat === 0) {
        this.bass(midi(root), { type: 'sine', dur: stepDur * 8.6, vol: 0.38, delay, attack: 0.5, presence: 0.16 });
        this.tone({ f0: midi(root + 7), type: 'sine', dur: stepDur * 8.6, vol: 0.12, delay, dest: mus, attack: 0.7 });
        if (A.cluster) this.tone({ f0: midi(root + 13), type: 'sine', dur: stepDur * 8.6, vol: 0.08, delay, dest: mus, attack: 0.9 });
      }
    }
    if (L.lead) {
      if (A.lead) {
        const n = A.lead[step];
        if (n) this.tone({ f0: midi(n), type: A.leadWave, dur: stepDur * (A.leadLen || 0.8), vol: A.leadVol, delay, dest: mus, attack: 0.01 });
      } else if (A.arp) {
        this.tone({ f0: midi(root + 24 + A.arp[beat]), type: A.leadWave, dur: stepDur * 0.9, vol: A.leadVol, delay, dest: mus, attack: 0.01 });
      }
      if (A.ping && beat === 4 && bar % 2 === 0) {
        this.tone({ f0: midi(root + 36 + [0, 7, 3, 10][bar / 2]), type: 'sine', dur: 1.8, vol: 0.12, delay, dest: mus, attack: 0.005 });
      }
    }
    if (L.perc) {
      if (A.hat === 'type' && (step * 7) % 5 < 2) this.noise(0.018, 0.1, delay, { dest: mus, type: 'bandpass', freq: 2600 });
      if ((A.hat === 'odd' && beat % 2 === 1) || (A.hat === 'swing' && (beat === 3 || beat === 7))) {
        this.noise(0.03, 0.12, delay, { dest: mus, type: 'highpass', freq: 6000 });
      }
      if (A.clap && (beat === 2 || beat === 6)) this.noise(0.08, 0.22, delay, { dest: mus, type: 'bandpass', freq: 1500 });
    }
  }
}
