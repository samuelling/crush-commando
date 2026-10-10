// Bridge to the combined "Crush Commando x Hollow Dash" page (../index.html).
// Only active when this page runs inside the hub's iframe with ?hub in the URL; on its own the game
// plays exactly as before.
//
// The hub owns the network connection. This module tells it where the player is (for friends to
// see), hears about friends, draws them, shares stomps, and handles portal arrivals and "join friend".
import { T, LEVEL_BOTTOM } from './level.js';
import { CHAPTERS } from './chapters.js';
import * as R from './render.js';
import { HUB, PORTAL_CH, portalLabel } from './hubcfg.js';

export { HUB };

export const PLAYER_COLS = ['#ff5d8a', '#4fc3f7', '#ffd54f', '#81c784', '#ba68c8', '#ff8a50', '#4dd0e1', '#e0e0e0'];

const net = { me: null, n: 0, peers: new Map(), loc: null, sendT: 0, killed: new Set() };
let G = null, ctx = null;

const post = (m) => { try { window.parent.postMessage({ hub: 1, ...m }, '*'); } catch (_) { /* detached */ } };
const ev = (e) => post({ t: 'ev', e });

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
const PALS = PLAYER_COLS.map((c) => ({ feet: shade(c, -0.35), body: c, belly: shade(c, 0.35) }));

function locOf(game) {
  const s = game.state === 'paused' ? game.prevState : game.state;
  return ['playing', 'respawn', 'dying'].includes(s) ? 'hd:' + game.level.startChapter : null;
}
function labelOf(game) {
  const s = game.state === 'paused' ? game.prevState : game.state;
  if (s === 'mind') return 'Inside the mind';
  if (s === 'crawl') return 'Deep in the mind';
  if (s === 'title') return 'On the title screen';
  const ch = CHAPTERS[game.chapterIdx];
  return ch.num + ' · ' + ch.title;
}

export function initHub(opts) {
  if (!HUB.on) return;
  const { game, sound, input, ui, startGame, restartAt } = opts;
  G = game; ctx = opts;
  game.netKilled = net.killed;
  game.onKill = (uid) => { net.killed.add(uid); if (net.loc) ev({ k: 'kill', loc: net.loc, uid }); };
  game.onPortal = (id) => {
    sound.play('chapter');
    game.flash = 0.8;
    input.reset();
    post({ t: 'portal', id, held: heldKeys() });
  };
  game.drawPeers = drawPeers;

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || e.data.hub !== 1) return;
    const m = e.data;
    switch (m.t) {
      case 'me': net.me = m.id; net.n = m.n; break;
      case 'sleep': HUB.asleep = true; input.reset(); sound.sleep(); break;
      case 'wake': wake(); break;
      case 'enter': wake(); arrive(m.id, m.held); break;
      case 'goto': wake(); gotoFriend(m); break;
      case 'peer': {
        let q = net.peers.get(m.p.id);
        if (!q) { q = { id: m.p.id, rx: 0, ry: 0, run: 0, fresh: true }; net.peers.set(m.p.id, q); }
        Object.assign(q, { n: m.p.n, name: m.p.name, col: m.p.col | 0 });
        if (m.p.s) {
          q.s = m.p.s; q.age = 0;
          if (q.s.gr && q.s.loc) q.ground = { loc: q.s.loc, x: q.s.x, y: q.s.y, sc: q.s.sc || 1 };
        }
        break;
      }
      case 'gone': net.peers.delete(m.id); break;
      case 'ev': onEvent(m.from, m.e); break;
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG' && !e.repeat) post({ t: 'join' });
  });

  function wake() {
    if (!HUB.asleep) return;
    HUB.asleep = false;
    input.reset();
    sound.unlock();
  }

  function heldKeys() { return [...input.keys]; }
  function holdKeys(held) {
    if (!held) return;
    for (const k of held) if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(k)) input.keys.add(k);
    input.recompute();
  }

  // Make sure we are on a running road for chapter `sc`, starting fresh if that road isn't loaded.
  function ensureRoad(sc, x) {
    const s = game.state === 'paused' ? game.prevState : game.state;
    if (game.state === 'title') { startGame(sc); return; }
    if (['mind', 'crawl', 'dying'].includes(s)) { restartAt(sc); return; }
    if (game.state === 'paused') game.resume();
    const far = x != null && x < game.cam.x - 300;
    if (game.level.startChapter !== sc || far) game.jumpToChapter(sc);
  }

  function arrive(id, held) {
    const c = PORTAL_CH[id];
    if (c == null) return;
    const lv0 = game.level;
    const here = game.state !== 'title' && lv0.startChapter <= c && lv0.portalAt[c] && lv0.portalAt[c].x >= game.cam.x - 300;
    if (!here) ensureRoad(c, null);
    else if (game.state === 'paused') game.resume();
    const lv = game.level;
    for (let i = 0; i < 400 && !lv.portalAt[c]; i++) lv.ensure(lv.genCol + 1);
    const pa = lv.portalAt[c];
    if (pa) game.teleportTo(pa.x + 1.6 * T, pa.y);
    game.flash = 1;
    game.texts.push({ x: game.player.cx, y: game.player.y - 40, text: 'out of ' + portalLabel(id), life: 2.2, vy: -30, color: '#ffb3c8' });
    holdKeys(held);
  }

  function gotoFriend(m) {
    const sc = +String(m.loc || '').split(':')[1];
    if (!(sc >= 0)) return;
    ensureRoad(sc, m.x);
    const bottom = m.y + 42 * (m.sc || 1);
    game.teleportTo(m.x + 15 - 46, Math.min(bottom, LEVEL_BOTTOM - T));
    game.flash = 1;
    game.texts.push({ x: game.player.cx, y: game.player.y - 40, text: 'with ' + (m.name || 'your friend'), life: 2, vy: -30, color: '#bfe6ff' });
  }

  function onEvent(from, e) {
    if (!e || e.loc !== net.loc) return;
    if (e.k === 'kill') {
      net.killed.add(e.uid);
      const en = game.enemies.find((q) => q.uid === e.uid && !q.dead);
      if (en) {
        en.dead = true;
        sound.play('stomp');
        game.burst(en.x + en.w / 2, en.y + en.h / 2, 14, en.type === 'bat' ? '#5a4580' : '#a983ff', 200, 0.7, 7, 700, 0);
      }
    } else if (e.k === 'killq') {
      post({ t: 'ev', to: from, e: { k: 'kills', loc: net.loc, uids: [...net.killed].slice(-300) } });
    } else if (e.k === 'kills' && Array.isArray(e.uids)) {
      for (const u of e.uids) {
        net.killed.add(u);
        const en = game.enemies.find((q) => q.uid === u);
        if (en) en.dead = true;
      }
    }
  }
  post({ t: 'ready', game: 'hd' });
}

// Called every fixed step from main.js.
export function hubStep(dt) {
  if (!HUB.on || !G) return;
  const game = G;
  const loc = locOf(game);
  if (loc !== net.loc) {
    net.loc = loc;
    net.killed.clear();
    if (loc) ev({ k: 'killq', loc });
  }
  for (const q of net.peers.values()) {
    if (!q.s) continue;
    q.age = (q.age || 0) + dt;
    const s = q.s, lead = Math.min(q.age, 0.15);
    const tx = s.x + (s.vx || 0) * lead, ty = s.y + (s.vy || 0) * lead * 0.5;
    if (q.fresh || Math.abs(tx - q.rx) > 400 || Math.abs(ty - q.ry) > 300) { q.rx = tx; q.ry = ty; q.fresh = false; }
    const k = Math.min(1, dt * 14);
    q.rx += (tx - q.rx) * k; q.ry += (ty - q.ry) * k;
    if (s.gr && Math.abs(s.vx || 0) > 20) q.run += dt * 16 * Math.abs(s.vx) / 290;
  }
  net.sendT -= dt;
  if (net.sendT <= 0) {
    net.sendT = loc && !HUB.asleep ? 1 / 15 : 1;
    const p = game.player;
    const s = { g: 'hd', loc, label: labelOf(game) };
    if (loc) Object.assign(s, {
      x: Math.round(p.x), y: Math.round(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), f: p.facing,
      gr: p.grounded ? 1 : 0, sp: Math.round(p.spin * 100) / 100, sc: p.scale, fl: p.flying ? 1 : 0, iv: p.ring === 'invisible' ? 1 : 0,
    });
    post({ t: 'state', s });
  }
}

// Friends in the same stretch of road, drawn in world space (called from Game.render).
function drawPeers(c) {
  if (!net.loc) return;
  const time = G.time;
  for (const q of net.peers.values()) {
    const s = q.s;
    if (!s || s.loc !== net.loc || q.age > 5) continue;
    const sc = s.sc || 1;
    const fake = {
      x: q.rx, y: q.ry, w: 30 * sc, h: 42 * sc, facing: s.f || 1, sx: 1, sy: 1, scale: sc, spin: s.sp || 0,
      runPhase: q.run, grounded: !!s.gr, vx: s.vx || 0, vy: s.vy || 0, trail: [], ring: null, flying: !!s.fl,
    };
    c.globalAlpha = s.iv ? 0.3 : 0.95;
    R.drawPlayer(c, fake, time, PALS[q.col % PALS.length]);
    c.globalAlpha = 1;
    const cx = q.rx + 15 * sc, ty = q.ry - 12;
    c.font = '700 13px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.lineWidth = 4; c.strokeStyle = 'rgba(10,8,20,0.75)'; c.strokeText(q.name || 'Friend', cx, ty);
    c.fillStyle = PLAYER_COLS[q.col % PLAYER_COLS.length]; c.fillText(q.name || 'Friend', cx, ty);
  }
}
