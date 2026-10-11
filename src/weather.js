// ===================== WEATHER: your real local weather and time of day =====================
// Rough location from your internet address (get.geojs.io, no permission prompt), current conditions
// from Open-Meteo (the same feed the bellweather norns script uses), and your own clock for the sun.
// Test any state with URL parameters: ?weather=rain|drizzle|storm|snow|fog|cloudy|clear&hour=21.5
const WX = {
  live: false, place: '', code: 0, temp: 60, hum: 50, wind: 3, prob: 0, cloud: 0.2,
  rain: 0, snow: 0, fog: 0, storm: 0, sunrise: 6.5, sunset: 18.5, hourOverride: null, forced: false,
};
const WXV = { day: 0.5, twi: 0, cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0 };   // smoothed, what's drawn
const WXP = { drops: [], flakes: [], lastCam: 0, bolt: null, flash: 0, nextBolt: 8, thunder: [] };
const WX_WORDS = { 0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'violent showers', 85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm, hail', 99: 'thunderstorm, hail' };
const WX_USE_F = /^en-(US|LR|MM)|^en$/.test(navigator.language || 'en-US');

function wxEnabled() { return !SAVE.wxOff; }
function wxApplyCode() {
  const c = WX.code;
  let rain = 0, snow = 0, fog = 0, storm = 0;
  if (c === 45 || c === 48) fog = 1;
  if (c >= 51 && c <= 57) rain = c === 51 ? 0.3 : c === 53 ? 0.4 : 0.5;
  if (c >= 61 && c <= 67) rain = { 61: 0.5, 63: 0.75, 65: 1, 66: 0.6, 67: 0.85 }[c];
  if (c >= 71 && c <= 77) snow = { 71: 0.45, 73: 0.7, 75: 1, 77: 0.4 }[c];
  if (c >= 80 && c <= 82) rain = [0.55, 0.8, 1][c - 80];
  if (c === 85 || c === 86) snow = c === 85 ? 0.6 : 1;
  if (c >= 95) { storm = 1; rain = Math.max(rain, 0.9); }
  if (rain && WX.temp <= 30 && c < 95) { snow = rain; rain = 0; }
  Object.assign(WX, { rain, snow, fog, storm });
  if (c >= 3 && WX.cloud < 0.85) WX.cloud = 0.85;
}
function wxForce(kind) {
  const codes = { clear: 0, cloudy: 3, overcast: 3, fog: 45, drizzle: 53, rain: 63, heavy: 65, storm: 95, snow: 73, blizzard: 75 };
  if (!(kind in codes)) return false;
  WX.code = codes[kind]; WX.cloud = kind === 'clear' ? 0.05 : 0.9; WX.prob = kind === 'clear' || kind === 'cloudy' || kind === 'fog' ? 5 : 90;
  WX.temp = kind === 'snow' || kind === 'blizzard' ? 26 : 58; WX.hum = kind === 'clear' ? 40 : 90; WX.wind = kind === 'storm' ? 28 : kind === 'blizzard' ? 32 : 8;
  WX.place = 'test weather'; WX.live = true; WX.forced = true;
  wxApplyCode();
  return true;
}
function wxReadCache(key, maxAge) {
  try { const c = JSON.parse(localStorage.getItem(key)); if (c && Date.now() - c.t < maxAge) return c.v; } catch (_) { }
  return null;
}
function wxWriteCache(key, v) { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (_) { } }

async function wxFetch() {
  if (WX.forced || !wxEnabled()) return;
  try {
    let geo = wxReadCache('cc.geo.v1', 24 * 3600e3);
    if (!geo) {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const j = await r.json();
      geo = { lat: (+j.latitude).toFixed(3), lon: (+j.longitude).toFixed(3), city: j.city || j.region || '' };
      if (!isFinite(+geo.lat)) throw new Error('no location');
      wxWriteCache('cc.geo.v1', geo);
    }
    let w = wxReadCache('cc.wx.v1', 10 * 60e3);
    if (!w) {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
        '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m' +
        '&hourly=precipitation_probability&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1';
      const j = await (await fetch(u)).json();
      const cur = j.current, hi = j.hourly.time.indexOf(cur.time.slice(0, 13) + ':00');
      const hrs = (s) => { const m = /T(\d\d):(\d\d)/.exec(s || ''); return m ? +m[1] + m[2] / 60 : null; };
      w = {
        code: cur.weather_code | 0, temp: cur.temperature_2m, hum: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
        cloud: (cur.cloud_cover || 0) / 100, precip: cur.precipitation || 0, prob: hi >= 0 ? j.hourly.precipitation_probability[hi] || 0 : 0,
        sunrise: hrs(j.daily.sunrise[0]), sunset: hrs(j.daily.sunset[0]),
      };
      wxWriteCache('cc.wx.v1', w);
    }
    Object.assign(WX, { code: w.code, temp: w.temp, hum: w.hum, wind: w.wind, cloud: w.cloud, prob: w.prob, place: geo.city, live: true });
    if (w.sunrise != null) WX.sunrise = w.sunrise;
    if (w.sunset != null) WX.sunset = w.sunset;
    wxApplyCode();
    if (w.precip > 0 && !WX.rain && !WX.snow) { if (WX.temp <= 32) WX.snow = 0.4; else WX.rain = 0.35; }
  } catch (e) { WX.live = false; }
}
function wxInit() {
  const q = new URLSearchParams(location.search);
  if (q.has('hour')) WX.hourOverride = ((+q.get('hour')) % 24 + 24) % 24;
  if (q.has('weather') && wxForce(q.get('weather'))) return;
  wxFetch();
  setInterval(wxFetch, 10 * 60e3);
}

// ---------- sun and moon ----------
function wxHour() { if (WX.hourOverride != null) return WX.hourOverride; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
// 0 at night, 1 in full daylight, ramping over ~1.5 hours around sunrise and sunset
function wxDaylight() {
  const h = wxHour(), ramp = (x) => clamp((x + 0.6) / 1.2, 0, 1);
  return Math.min(ramp(h - WX.sunrise), ramp(WX.sunset - h));
}
function wxTwilight() {
  const h = wxHour();
  return Math.max(0, 1 - Math.min(Math.abs(h - WX.sunrise), Math.abs(h - WX.sunset)) / 1.1);
}
// bellweather's own curves: daytime peaks ~1pm, moon is 0 (new) to 1 (full)
function wxDaytimeFactor() { return (Math.cos((wxHour() - 13) / 24 * 2 * Math.PI) + 1) / 2; }
function wxMoon() { const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5, ph = (days % 29.530588853) / 29.530588853; return (1 - Math.cos(ph * 2 * Math.PI)) / 2; }

function wxLabel(short) {
  if (!WX.live) return '';
  const t = WX_USE_F ? `${Math.round(WX.temp)}°F` : `${Math.round((WX.temp - 32) * 5 / 9)}°C`;
  const word = WX_WORDS[WX.code] || 'clear';
  if (short) return `${t} ${word}`;
  return `${WX.place ? WX.place + ': ' : ''}${word}, ${t}`;
}

// ---------- per-frame state ----------
function wxTick(dt) {
  const on = wxEnabled() && (WX.live || WX.hourOverride != null);
  const k = Math.min(1, dt * 0.8);
  const tgt = on ? { day: wxDaylight(), twi: wxTwilight(), cloud: WX.cloud * (WX.live ? 1 : 0), rain: WX.rain, snow: WX.snow, fog: WX.fog, storm: WX.storm }
    : { day: -1, twi: 0, cloud: 0, rain: 0, snow: 0, fog: 0, storm: 0 };
  const snap = !WXV.ready && on; if (on) WXV.ready = true;
  for (const key in tgt) WXV[key] += (tgt[key] - WXV[key]) * (snap || (key === 'day' && Math.abs(tgt[key] - WXV[key]) > 0.9) ? 1 : k);
  WXV.off = !on;
  // lightning
  if (WXV.storm > 0.5) {
    WXP.nextBolt -= dt;
    if (WXP.nextBolt <= 0) {
      WXP.nextBolt = 6 + Math.random() * 10; WXP.flash = 0.9;
      const x0 = 40 + Math.random() * (VW - 80), pts = [[x0, 0]];
      for (let y = 0; y < 150;) { y += 10 + Math.random() * 16; pts.push([pts[pts.length - 1][0] + (Math.random() - 0.5) * 26, y]); }
      WXP.bolt = { pts, t: 0.25 };
      WXP.thunder.push(0.4 + Math.random() * 1.4);
    }
  }
  if (WXP.flash > 0) WXP.flash -= dt * 2.4;
  if (WXP.bolt && (WXP.bolt.t -= dt) <= 0) WXP.bolt = null;
  for (let i = WXP.thunder.length - 1; i >= 0; i--) if ((WXP.thunder[i] -= dt) <= 0) { WXP.thunder.splice(i, 1); wxThunder(); }
}
function wxThunder() {
  const c = AU.ctx; if (!c || !AU.sfxOn || !AU.noiseBuf) return;
  const t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
  src.buffer = AU.noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 160 + Math.random() * 120;
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.9, t + 0.08); gn.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
  src.connect(f); f.connect(gn); gn.connect(AU.sfx); src.start(t); src.stop(t + 2.7);
}
// How much darker (+) or lighter (-) the scene's shadow layer should be.
function wxDarkBoost() {
  if (WXV.off || WXV.day < 0) return 0;
  const cave = G.world === 1 ? 0.45 : 1;
  return (-0.3 * WXV.day * (1 - WXV.cloud * 0.45) + 0.08 * (1 - WXV.day) + WXV.storm * 0.08 + WXV.rain * 0.04) * cave;
}

// ---------- drawing ----------
// Sky colour for the time of day, drawn over a world's own sky.
function wxSkyTint(g, w) {
  if (WXV.off || WXV.day < 0) return;
  const d = WXV.day, tw = WXV.twi, cl = WXV.cloud, cave = w === 1 ? 0.45 : 1;
  if (d > 0.01) {
    const gr = g.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, '#5aa8ec'); gr.addColorStop(0.7, '#a9d6f5'); gr.addColorStop(1, '#d8eefa');
    g.globalAlpha = d * 0.62 * (1 - cl * 0.55) * cave; g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    if (w === 0) { g.globalAlpha = d * 0.8; circ(g, 380, 52, 21, '#7fbcee'); }   // the grove's painted moon sets by day
    // the sun, crossing the sky from sunrise to sunset
    const p = clamp((wxHour() - WX.sunrise) / Math.max(1, WX.sunset - WX.sunrise), 0, 1), sx = 40 + p * (VW - 80), sy = 150 - Math.sin(p * Math.PI) * 120;
    g.globalAlpha = d * (1 - cl * 0.85) * cave;
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 46); sg.addColorStop(0, 'rgba(255,250,220,0.9)'); sg.addColorStop(0.25, 'rgba(255,240,190,0.5)'); sg.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = sg; g.fillRect(sx - 46, sy - 46, 92, 92);
  }
  if (tw > 0.01) {
    const gr = g.createLinearGradient(0, 40, 0, VH);
    gr.addColorStop(0, 'rgba(255,110,150,0.25)'); gr.addColorStop(0.5, 'rgba(255,120,80,0.8)'); gr.addColorStop(1, 'rgba(255,186,96,0.95)');
    g.globalAlpha = tw * 0.7 * (1 - cl * 0.5) * cave; g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  }
  if (d < 0.99) { g.globalAlpha = (1 - d) * 0.28 * cave; g.fillStyle = '#0a0c26'; g.fillRect(0, 0, VW, VH); }
  if (cl > 0.05) { g.globalAlpha = cl * 0.42 * cave; g.fillStyle = d > 0.5 ? '#8f98a3' : '#20232b'; g.fillRect(0, 0, VW, VH); }
  g.globalAlpha = 1;
}
// Rain, snow, fog and lightning, in screen space over everything but the HUD.
function wxDrawFront(g, camDX, fp) {
  if (WXV.off) return;
  const cave = G.world === 1, wind = clamp(WX.wind / 30, 0, 1) * (WX.wind > 0 ? 1 : 0);
  // rain (drips from the ceiling in the caves)
  const nRain = Math.round(WXV.rain * (cave ? 26 : 170));
  while (WXP.drops.length < nRain) WXP.drops.push({ x: Math.random() * VW, y: Math.random() * VH, v: 0.8 + Math.random() * 0.5 });
  if (WXP.drops.length > nRain) WXP.drops.length = nRain;
  if (nRain) {
    g.strokeStyle = cave ? 'rgba(150,220,255,0.75)' : 'rgba(175,205,255,0.5)'; g.lineWidth = 1; g.beginPath();
    const vx = cave ? 0 : -60 - wind * 160, vy = cave ? 210 : 430;
    for (const p of WXP.drops) {
      p.x += (vx * p.v / 60) - camDX; p.y += vy * p.v / 60;
      if (p.y > VH) { p.y = cave ? Math.random() * 40 : -8; p.x = Math.random() * (VW + 60); }
      if (p.x < -10) p.x += VW + 20; if (p.x > VW + 10) p.x -= VW + 20;
      const len = cave ? 2 : 5 + p.v * 3;
      g.moveTo(Math.round(p.x) + 0.5, Math.round(p.y)); g.lineTo(Math.round(p.x + vx / vy * len) + 0.5, Math.round(p.y + len));
    }
    g.stroke();
  }
  // snow (ash in the Heartbreak Core)
  const nSnow = Math.round(WXV.snow * (cave ? 0 : 130));
  while (WXP.flakes.length < nSnow) WXP.flakes.push({ x: Math.random() * VW, y: Math.random() * VH, v: 0.5 + Math.random() * 0.8, ph: Math.random() * 6, s: Math.random() < 0.3 ? 2 : 1 });
  if (WXP.flakes.length > nSnow) WXP.flakes.length = nSnow;
  const ash = G.world === 4;
  for (const p of WXP.flakes) {
    p.ph += 0.03; p.x += (Math.sin(p.ph) * 0.4 - wind * 1.2 * p.v) - camDX; p.y += 0.55 * p.v;
    if (p.y > VH) { p.y = -4; p.x = Math.random() * VW; }
    if (p.x < -6) p.x += VW + 12; if (p.x > VW + 6) p.x -= VW + 12;
    rect(g, Math.round(p.x), Math.round(p.y), p.s, p.s, ash ? '#9a8e88' : '#f4f8ff');
  }
  // fog: slow drifting bands
  if (WXV.fog > 0.02) {
    for (let i = 0; i < 3; i++) {
      const y = 120 + i * 45 + Math.sin(G.t * 0.2 + i) * 10, gr = g.createLinearGradient(0, y - 40, 0, y + 40);
      gr.addColorStop(0, 'rgba(210,214,220,0)'); gr.addColorStop(0.5, `rgba(210,214,220,${0.3 * WXV.fog})`); gr.addColorStop(1, 'rgba(210,214,220,0)');
      g.fillStyle = gr; g.fillRect(0, y - 40, VW, 80);
    }
    g.fillStyle = `rgba(200,205,212,${0.14 * WXV.fog})`; g.fillRect(0, 0, VW, VH);
  }
  // lightning
  if (WXP.bolt && !cave) {
    g.strokeStyle = 'rgba(240,240,255,0.95)'; g.lineWidth = 2; g.beginPath();
    WXP.bolt.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  if (WXP.flash > 0) { g.fillStyle = `rgba(225,230,255,${Math.min(0.55, WXP.flash * 0.6) * (cave ? 0.3 : 1)})`; g.fillRect(0, 0, VW, VH); }
}
