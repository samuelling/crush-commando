// The Deep Mind: partway through Dreamed Country the platformer bends into a different genre,
// a turn-based dungeon crawl through the floors of the writer's mind. No reflexes needed:
// explore by choosing doors, fight by choosing moves, grow by choosing boons.
// This file is pure game logic (no DOM), so it can be simulated and tested headless.
import { mulberry32 } from './util.js';

export const FLOORS = [
  {
    name: 'The Lobby of First Drafts', music: 'mind', blurb: 'Every story starts here, badly.',
    rooms: ['A hallway papered with rejection letters.', 'A waiting room. Everyone here is an opening line.', 'A coat check full of borrowed styles.',
      'A typing pool where the typewriters type themselves.', 'A corridor that keeps starting over.', 'A drawer the size of a room, full of unfinished sentences.'],
    foes: ['cliche', 'adverb', 'block'], events: ['ending', 'draft', 'mirror', 'genre'],
  },
  {
    name: 'Brooklyn, Remembered', music: 'swing', blurb: 'A block that is always summer and always ending.',
    rooms: ['A stoop with a view of the whole world.', 'A schoolyard with chalk lines for a game nobody remembers.', 'A fire escape over a street full of radios.',
      'A comic shop where every issue is number one.', 'A brownstone hallway that smells like somebody else’s dinner.', 'A hydrant, open, and a whole summer around it.'],
    foes: ['bigkid', 'pigeons', 'changing'], events: ['ring', 'stoopball', 'comics', 'genre'],
  },
  {
    name: 'The Detective’s Floor', music: 'noir', blurb: 'Rain on the inside of the windows.',
    rooms: ['An office with a name on the door that keeps changing.', 'A bar where nobody asks questions. It’s the law.', 'A file room. Your file is thicker than you’d like.',
      'A phone booth that rings when you walk past.', 'An alley with exactly one streetlight.', 'A car service dispatch, all the cars out.'],
    foes: ['hood', 'inquisitor', 'kangaroo'], events: ['client', 'karma', 'riff', 'tiger'],
  },
  {
    name: 'The County of Dreams', music: 'dream', blurb: 'The rules change at every door.',
    rooms: ['A field with a sign that says THIS FIELD.', 'A drive-in showing the movie of this room.', 'A salt flat with a hole that hums.',
      'A motel room where it is always three in the morning.', 'A road that ends in a doorway.', 'A library where every book is the one you meant to write.'],
    foes: ['nightmare', 'rule', 'lack'], events: ['radio', 'hole', 'vase', 'tiger', 'genre'], boss: 'blank',
  },
];

// Foes. Each move: [kind, ...numbers]. Kinds: attack n · multi n times · block n · buff n ·
// steal dmg words · karma dmg amount · charge · forbid action · erase
export const FOES = {
  cliche: { name: 'A Cliché', word: 'CLICHÉ', color: '#ff8f8f', hp: 10, xp: 6, desc: 'It has said this before. It will say it again.', moves: [['attack', 3]] },
  adverb: { name: 'An Adverb', word: 'SUDDENLY', color: '#ffd166', hp: 8, xp: 5, desc: 'Fast, loud, and unnecessary.', moves: [['multi', 2, 2], ['attack', 3]] },
  block: { name: 'Writer’s Block', word: 'BLOCK', color: '#aab1c0', hp: 14, xp: 7, desc: 'Solid. Patient. Nothing gets through.', moves: [['block', 5], ['attack', 4], ['block', 4]] },
  bigkid: { name: 'A Big Kid', word: 'GIMME', color: '#62d08c', hp: 16, xp: 8, desc: 'He wants your words. All of them.', moves: [['steal', 4, 4], ['attack', 5]] },
  pigeons: { name: 'Pigeons', word: 'COO COO COO', color: '#c9ced9', hp: 14, xp: 8, desc: 'There are more of them than there seemed.', moves: [['multi', 1, 4], ['multi', 2, 2]] },
  changing: { name: 'The Block Is Changing', word: 'FOR SALE', color: '#e8a868', hp: 18, xp: 9, desc: 'Every turn it gets a little more expensive.', moves: [['buff', 1], ['attack', 4], ['attack', 5]] },
  hood: { name: 'A Hood in a Fedora', word: 'TROUBLE', color: '#9fb0ff', hp: 22, xp: 10, desc: 'He has a client. You are the client’s problem.', moves: [['attack', 6], ['block', 5], ['attack', 7]] },
  inquisitor: { name: 'An Inquisitor', word: 'WHY?', color: '#ff7a90', hp: 20, xp: 10, desc: 'Licensed to ask questions. You are not.', moves: [['karma', 5, 20], ['attack', 6]] },
  kangaroo: { name: 'A Kangaroo Enforcer', word: 'ROO', color: '#e0ad76', hp: 26, xp: 12, desc: 'Good suit. Bad mood. Strong legs.', moves: [['attack', 4], ['charge'], ['attack', 12]] },
  nightmare: { name: 'Somebody’s Nightmare', word: 'NOT AGAIN', color: '#c99dff', hp: 26, xp: 12, desc: 'It isn’t yours, but it fits.', random: true, moves: [['attack', 8], ['multi', 2, 3], ['block', 8], ['attack', 5]] },
  rule: { name: 'A Rule', word: 'NO.', color: '#8fe6ff', hp: 24, xp: 12, desc: 'In this county you may not do the obvious thing.', moves: [['forbid', 'guard'], ['attack', 7], ['forbid', 'strike'], ['attack', 7]] },
  lack: { name: 'The Lack', word: '( )', color: '#e9e1cc', hp: 26, xp: 13, desc: 'It only takes what it wants. It doesn’t want your fists.', immune: 'strike', moves: [['attack', 6], ['attack', 8]] },
  blank: { name: 'The Blank Page', word: ' ', color: '#f4ecd8', hp: 64, xp: 30, boss: true, desc: 'Nothing on it yet. It would like to keep it that way.', moves: [['attack', 8], ['erase'], ['block', 10], ['attack', 11], ['multi', 3, 3]] },
};

export const BOONS = [
  { id: 'wit', name: 'Sharper', text: '+2 Wit. Every strike lands harder.', repeat: true, apply: (c) => { c.s.wit += 2; } },
  { id: 'nerve', name: 'Steadier', text: '+2 Nerve. Your guard holds more.', repeat: true, apply: (c) => { c.s.nerve += 2; } },
  { id: 'heart', name: 'Thicker Skin', text: '+6 Heart, and heal 6.', repeat: true, apply: (c) => { c.s.maxHp += 6; c.s.hp += 6; } },
  { id: 'ring', name: 'The Ring', text: 'Once a fight: turn invisible. Their next attack misses.' },
  { id: 'second', name: 'Second Thought', text: 'Once a fight: heal 9.' },
  { id: 'wordplay', name: 'Wordplay', text: 'A new move: three quick hits, each a little lighter. Good against guards.' },
  { id: 'stoopball', name: 'Stoop Ball', text: 'A new move: guard and bounce it back. Hits for twice your Nerve.' },
  { id: 'collage', name: 'Collage', text: 'Once a fight: cut out their last attack and paste it back on them, doubled.' },
  { id: 'roo', name: 'A Kangaroo in a Good Suit', text: 'He fights beside you. Every hit does 2 more.' },
  { id: 'dime', name: 'Lucky Dime', text: 'One in five attacks against you just misses.' },
  { id: 'footnotes', name: 'Footnotes', text: 'Riffing costs 1 word instead of 2, and hits harder.' },
  { id: 'eyes', name: 'Night Eyes', text: 'See what is behind every door on each floor.' },
  { id: 'insight', name: 'Insight', text: 'Long shots come through more often: +15% on every chance.' },
];

const TREASURE = ['A drawer of unsent letters.', 'A shoebox of ticket stubs and good adjectives.', 'A pile of words someone cut from a draft.', 'A coat pocket with a better ending in it.', 'A jar of commas, somehow full.'];

const W = 5, H = 3, GOAL_ROOMS = 9;
const xpNeed = (lv) => 6 + lv * 6;
const pct = (p) => `${Math.round(p * 100)}%`;

export class Crawl {
  constructor({ seed = (Math.random() * 1e9) | 0, memory = 0, sound = null, onKarma = () => {} } = {}) {
    this.rng = mulberry32(seed);
    this.sound = sound; this.onKarma = onKarma;
    this.s = { hp: 30, maxHp: 30, wit: 5, nerve: 3, words: 6, level: 1, xp: 0 };
    this.boons = [];
    this.usedEvents = new Set();
    this.log = [];
    this.result = null;
    this.queue = [];          // pending boon choices
    this.floorIdx = -1;
    this.gifts = Math.min(2, memory);
    this.nextFloor();
    for (let i = 0; i < this.gifts; i++) this.queue.push({ title: 'You remember something from last time', sub: 'Choose a gift to start with.' });
    this.say(this.gifts ? 'You came back through the door. Something you learned came with you.' : 'You stepped through the door and into the mind that is writing all this.');
    this.flushQueue();
  }

  has(id) { return this.boons.includes(id); }
  play(n) { if (this.sound) this.sound.play(n); }
  say(t) { this.log.push(t); if (this.log.length > 6) this.log.shift(); }
  r() { return this.rng(); }
  pick(a) { return a[Math.floor(this.r() * a.length)]; }
  get floor() { return FLOORS[this.floorIdx]; }
  get room() { return this.map.rooms[this.pos]; }
  chance(p) { return Math.max(0.05, Math.min(0.95, p + (this.has('insight') ? 0.15 : 0))); }
  check(stat, target) { return this.chance(0.5 + (this.s[stat] - target) * 0.12); }

  // ---- floors and maps ----------------------------------------------------------
  nextFloor() {
    this.floorIdx++;
    this.revealAll = false;
    this.map = this.genMap();
    this.pos = this.map.start;
    this.room.visited = true; this.room.done = true;
    this.state = 'explore';
    this.scene = { title: this.floor.name, text: `${this.floor.blurb} Floor ${this.floorIdx + 1} of ${FLOORS.length}.` };
    this.music = this.floor.music;
  }

  genMap() {
    const key = (x, y) => `${x},${y}`;
    const rooms = {};
    const add = (x, y) => (rooms[key(x, y)] = rooms[key(x, y)] || { x, y, links: new Set(), type: 'empty' });
    const start = key(0, 1);
    add(0, 1);
    while (Object.keys(rooms).length < GOAL_ROOMS) {
      const from = this.pick(Object.values(rooms));
      const [dx, dy] = this.pick([[1, 0], [1, 0], [0, 1], [0, -1], [-1, 0]]);
      const nx = from.x + dx, ny = from.y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const to = add(nx, ny);
      from.links.add(key(nx, ny)); to.links.add(key(from.x, from.y));
    }
    // a few extra doors so there are real route choices
    for (const r of Object.values(rooms)) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const n = rooms[key(r.x + dx, r.y + dy)];
        if (n && this.r() < 0.35) { r.links.add(key(n.x, n.y)); n.links.add(key(r.x, r.y)); }
      }
    }
    // the stairs go in the room farthest from the start
    const dist = { [start]: 0 }, q = [start];
    while (q.length) { const k = q.shift(); for (const n of rooms[k].links) if (dist[n] == null) { dist[n] = dist[k] + 1; q.push(n); } }
    const stairs = Object.keys(rooms).filter((k) => k !== start).sort((a, b) => dist[b] - dist[a] || rooms[b].x - rooms[a].x)[0];
    rooms[start].type = 'start';
    rooms[stairs].type = this.floor.boss ? 'boss' : 'stairs';
    const bag = ['fight', 'fight', 'fight', 'event', 'event', 'treasure', this.floorIdx % 2 ? 'shop' : 'rest'];
    if (this.floorIdx >= 2) bag.push('fight');
    const rest = Object.keys(rooms).filter((k) => k !== start && k !== stairs).sort(() => this.r() - 0.5);
    rest.forEach((k, i) => { rooms[k].type = bag[i % bag.length]; });
    for (const k of Object.keys(rooms)) rooms[k].text = this.pick(this.floor.rooms);
    return { rooms, start, W, H };
  }

  // What the player can see of the map: visited rooms, and the rooms behind their doors.
  cells() {
    const out = [];
    const eyes = this.has('eyes') || this.revealAll;
    for (const [k, r] of Object.entries(this.map.rooms)) {
      const near = [...r.links].some((n) => this.map.rooms[n].visited);
      const seen = r.visited || near || eyes;
      const canGo = this.state === 'explore' && this.room.links.has(k);
      out.push({ key: k, x: r.x, y: r.y, here: k === this.pos, visited: r.visited, done: r.done, seen, known: seen, type: r.type, canGo, links: [...r.links] });
    }
    return out;
  }

  // ---- the decisions on offer right now ------------------------------------------------
  options() {
    if (this.state === 'boon') return this.boonOpts.map((b, i) => ({ id: `boon:${i}`, label: b.name, sub: b.text, kind: 'choice' }));
    if (this.state === 'fight') return this.fightOptions();
    if (this.state === 'event' || this.state === 'rest' || this.state === 'shop') return this.choiceOpts;
    if (this.state === 'explore') {
      const o = [];
      if ((this.room.type === 'stairs') && this.room.done) o.push({ id: 'down', label: `Go down to floor ${this.floorIdx + 2}`, sub: FLOORS[this.floorIdx + 1].name, kind: 'action' });
      for (const k of this.room.links) {
        const r = this.map.rooms[k];
        o.push({ id: `move:${k}`, label: r.visited ? 'Go back' : 'Open the door', sub: r.visited ? '' : LABEL[r.type], kind: 'move', key: k });
      }
      return o;
    }
    return [];
  }

  choose(id) {
    if (this.result) return;
    if (id.startsWith('boon:')) return this.takeBoon(+id.slice(5));
    if (id.startsWith('move:')) return this.moveTo(id.slice(5));
    if (id === 'down') {
      const heal = Math.ceil(this.s.maxHp * 0.25);
      this.s.hp = Math.min(this.s.maxHp, this.s.hp + heal);
      this.play('page');
      this.say(`You caught your breath on the stairs (+${heal} Heart). The air got stranger.`);
      this.nextFloor();
      return;
    }
    if (this.state === 'fight') return this.act(id);
    const c = (this.choiceOpts || []).find((o) => o.id === id);
    if (c && !c.disabled) {
      this.play('select');
      const msg = c.go();
      if (msg) this.say(msg);
      if (this.state !== 'fight' && this.s.hp < 1) this.s.hp = 1;   // only fights can send you back
      if (this.state === 'event' || this.state === 'rest' || this.state === 'shop') {
        if (!c.stay) this.finishRoom();
        else if (this.state === 'shop') this.openShop(this.room);   // refresh what you can afford
      }
      this.flushQueue();
    }
  }

  moveTo(k) {
    if (!this.room.links.has(k)) return;
    this.pos = k;
    const r = this.room;
    this.play('select');
    r.visited = true;
    if (r.done) { this.scene = { title: 'Back again', text: r.text }; return; }
    this.enterRoom(r);
    this.flushQueue();
  }

  finishRoom() {
    this.room.done = true;
    this.state = 'explore';
    this.choiceOpts = null;
    this.music = this.floor.music;
  }

  enterRoom(r) {
    switch (r.type) {
      case 'fight': this.startFight(this.pick(this.floor.foes), r.text); break;
      case 'boss': this.startFight(this.floor.boss, 'The last room. The walls are blank, and so is the thing waiting in it.'); break;
      case 'stairs': r.done = true; this.scene = { title: 'Stairs, going down', text: `${r.text} At the back, stairs go down. Something below is louder.` }; break;
      case 'treasure': {
        const n = 5 + Math.floor(this.r() * 5);
        this.s.words += n;
        r.done = true;
        this.scene = { title: 'Something left behind', text: `${this.pick(TREASURE)} You took the best of it.` };
        this.say(`+${n} words.`);
        this.play('coin');
        this.gainXp(3);
        break;
      }
      case 'rest': this.openRest(r); break;
      case 'shop': this.openShop(r); break;
      default: this.openEvent(r);
    }
  }

  // ---- fights --------------------------------------------------------------------------
  startFight(id, text) {
    const f = FOES[id];
    const scale = 1 + (this.r() - 0.5) * 0.15;
    this.foe = { id, ...f, hp: Math.round(f.hp * scale), maxHp: Math.round(f.hp * scale), block: 0, buff: 0, step: 0, exposed: 0, lastHit: 0 };
    this.fight = { block: 0, used: new Set(), forbid: null, invisible: false, turn: 1 };
    this.state = 'fight';
    this.scene = { title: f.name, text };
    this.music = 'fight';
    this.planIntent();
    this.say(f.boss ? 'The Blank Page turns toward you. There is nothing written on it at all.' : `${f.name} is here.`);
  }

  planIntent() {
    const f = this.foe;
    f.intent = f.random ? this.pick(f.moves) : f.moves[f.step % f.moves.length];
    f.step++;
  }

  intentText() {
    const [k, a, b] = this.foe.intent, buff = this.foe.buff;
    switch (k) {
      case 'attack': return `Attack ${a + buff}`;
      case 'multi': return `Attack ${a + buff} × ${b}`;
      case 'block': return `Guard ${a}`;
      case 'buff': return `Grow stronger (+${a})`;
      case 'steal': return `Hit ${a + buff} and take ${b} words`;
      case 'karma': return `Ask you a question (${a + buff}, −${b} karma)`;
      case 'charge': return 'Winding up a huge kick…';
      case 'forbid': return `Forbid ${a === 'guard' ? 'guarding' : 'striking'}`;
      case 'erase': return 'Erase your guard and some words';
    }
    return '';
  }

  fightOptions() {
    const s = this.s, F = this.fight, f = this.foe;
    const riffCost = this.has('footnotes') ? 1 : 2;
    const o = [
      { id: 'strike', label: 'Strike', sub: `${this.dmgPreview(s.wit, 'strike')} damage`, disabled: F.forbid === 'strike' },
      { id: 'guard', label: 'Guard', sub: `block ${2 + s.nerve}`, disabled: F.forbid === 'guard' },
      { id: 'riff', label: 'Riff', sub: `${this.dmgPreview(s.wit * 2 + (this.has('footnotes') ? 2 : 0), 'riff')} damage · ${riffCost} words`, disabled: s.words < riffCost },
      { id: 'ask', label: 'Ask a Question', sub: 'expose it for 2 turns · −10 karma', disabled: F.used.has('ask') },
    ];
    if (this.has('wordplay')) o.push({ id: 'wordplay', label: 'Wordplay', sub: `3 × ${this.dmgPreview(Math.ceil(s.wit * 0.6), 'wordplay')}` });
    if (this.has('stoopball')) o.push({ id: 'stoopball', label: 'Stoop Ball', sub: `${this.dmgPreview(s.nerve * 2, 'stoopball')} damage, block ${s.nerve}` });
    if (this.has('ring')) o.push({ id: 'ring', label: 'The Ring', sub: 'their next attack misses', disabled: F.used.has('ring') });
    if (this.has('second')) o.push({ id: 'second', label: 'Second Thought', sub: 'heal 9', disabled: F.used.has('second') });
    if (this.has('collage')) o.push({ id: 'collage', label: 'Collage', sub: f.lastHit ? `${f.lastHit * 2} damage` : 'nothing to cut out yet', disabled: F.used.has('collage') || !f.lastHit });
    return o.map((x) => ({ ...x, kind: 'action' }));
  }

  dmgPreview(base, how) {
    let d = base + (this.has('roo') ? 2 : 0);
    if (this.foe.immune === how || (this.foe.immune === 'strike' && how === 'wordplay')) d = Math.ceil(d * 0.35);
    if (this.foe.exposed > 0) d = Math.ceil(d * 1.5);
    return d;
  }

  hitFoe(base, how) {
    const f = this.foe;
    let d = this.dmgPreview(base, how);
    const absorbed = Math.min(f.block, d);
    f.block -= absorbed; d -= absorbed;
    f.hp -= d;
    return d;
  }

  act(id) {
    const s = this.s, F = this.fight, f = this.foe;
    const opt = this.fightOptions().find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    F.block = 0;
    F.forbid = null;
    let line = '';
    switch (id) {
      case 'strike': { const d = this.hitFoe(s.wit, 'strike'); line = f.immune === 'strike' ? `Your fist goes mostly through it. ${d} damage.` : `You strike. ${d} damage.`; this.play('stomp'); break; }
      case 'guard': F.block = 2 + s.nerve; line = `You brace yourself. Block ${F.block}.`; this.play('land'); break;
      case 'riff': { s.words -= this.has('footnotes') ? 1 : 2; const d = this.hitFoe(s.wit * 2 + (this.has('footnotes') ? 2 : 0), 'riff'); line = `You riff. Words do what fists can’t. ${d} damage.`; this.play('word'); break; }
      case 'ask': F.used.add('ask'); f.exposed = 3; this.onKarma(-10); line = 'You ask a question. It costs you karma, but now you know where it’s weak.'; this.play('ding'); break;
      case 'wordplay': { let t = 0; for (let i = 0; i < 3; i++) t += this.hitFoe(Math.ceil(s.wit * 0.6), 'wordplay'); line = `Three quick ones. ${t} damage.`; this.play('stomp'); break; }
      case 'stoopball': { const d = this.hitFoe(s.nerve * 2, 'stoopball'); F.block = s.nerve; line = `Off the point of the step and back. ${d} damage, block ${F.block}.`; this.play('bounce'); break; }
      case 'ring': F.used.add('ring'); F.invisible = true; line = 'You turn the ring. You are very hard to see.'; this.play('ring'); break;
      case 'second': F.used.add('second'); s.hp = Math.min(s.maxHp, s.hp + 9); line = 'You think it over again. +9 Heart.'; this.play('heart'); break;
      case 'collage': { F.used.add('collage'); const d = this.hitFoe(f.lastHit * 2, 'collage'); line = `You cut out what it did to you and paste it back. ${d} damage.`; this.play('page'); break; }
    }
    this.say(line);
    if (f.hp <= 0) return this.winFight();
    this.foeTurn();
    if (f.exposed > 0) f.exposed--;
    F.turn++;
  }

  hurtPlayer(n, label) {
    const F = this.fight, s = this.s;
    if (F.invisible) { F.invisible = false; this.say(`${label} — and misses. Nobody can see you.`); return 0; }
    if (this.has('dime') && this.r() < 0.2) { this.say(`${label} — the dime glints. It misses.`); return 0; }
    const absorbed = Math.min(F.block, n);
    F.block -= absorbed;
    const d = n - absorbed;
    s.hp -= d;
    this.foe.lastHit = Math.max(this.foe.lastHit, n);
    if (d > 0) this.play('hurt');
    return d;
  }

  foeTurn() {
    const f = this.foe, s = this.s, F = this.fight;
    f.block = 0;
    const [k, a, b] = f.intent;
    const atk = (a || 0) + f.buff;
    switch (k) {
      case 'attack': { const d = this.hurtPlayer(atk, `${f.name} attacks`); this.say(`${f.name} hits you for ${d}.`); break; }
      case 'multi': { let t = 0; for (let i = 0; i < b; i++) t += this.hurtPlayer(atk, `${f.name} attacks`); this.say(`${f.name} hits you ${b} times for ${t}.`); break; }
      case 'block': f.block = a; this.say(`${f.name} guards (${a}).`); break;
      case 'buff': f.buff += a; this.say(`${f.name} gets stronger.`); break;
      case 'steal': { const d = this.hurtPlayer(atk, `${f.name} grabs`); const w = Math.min(s.words, b); s.words -= w; this.say(`${f.name} hits you for ${d} and takes ${w} words.`); break; }
      case 'karma': { const d = this.hurtPlayer(atk, `${f.name} asks`); this.onKarma(-b); this.say(`${f.name} asks you something you can’t answer. ${d} damage, −${b} karma.`); break; }
      case 'charge': this.say(`${f.name} crouches, tail braced. Something big is coming.`); break;
      case 'forbid': F.forbid = a; this.say(`${f.name}: no ${a === 'guard' ? 'guarding' : 'striking'} next turn.`); break;
      case 'erase': { F.block = 0; const d = this.hurtPlayer(6, `${f.name} erases`); const w = Math.min(s.words, 3); s.words -= w; this.say(`The page erases your guard and ${w} words. ${d} damage.`); break; }
    }
    if (s.hp <= 0) { s.hp = 0; this.state = 'wake'; this.result = { type: 'wake' }; this.play('fall'); this.say('Everything went white, then quiet.'); return; }
    this.planIntent();
  }

  winFight() {
    const f = this.foe;
    const words = f.boss ? 0 : 2 + Math.floor(this.r() * 4);
    this.s.words += words;
    this.play('checkpoint');
    this.say(f.boss ? 'Words fill the page, one at a time. They are yours.' : `${f.name} is gone. +${words} words.`);
    this.room.done = true;
    this.foe = null; this.fight = null;
    this.state = 'explore';
    this.music = this.floor.music;
    this.scene = { title: 'Quiet again', text: this.room.text };
    this.gainXp(f.xp);
    if (f.boss) { this.state = 'end'; this.result = { type: 'end', karma: 100 + this.s.level * 25 + this.s.words * 2 }; this.queue = []; return; }
    this.flushQueue();
  }

  // ---- growth ---------------------------------------------------------------------------
  gainXp(n) {
    const s = this.s;
    s.xp += n;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      s.maxHp += 4; s.hp = Math.min(s.maxHp, s.hp + 4);
      this.queue.push({ title: `Level ${s.level}`, sub: 'You are more yourself than you were. +4 Heart. Choose one.' });
      this.play('heart');
    }
  }

  flushQueue() {
    if (this.state !== 'explore' || !this.queue.length || this.result) return;
    const q = this.queue.shift();
    const pool = BOONS.filter((b) => b.repeat || !this.has(b.id));
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(this.r() * pool.length), 1)[0]);
    this.boonOpts = opts;
    this.state = 'boon';
    this.scene = { title: q.title, text: q.sub };
  }

  takeBoon(i) {
    const b = this.boonOpts[i];
    if (!b) return;
    if (b.apply) b.apply(this); else this.boons.push(b.id);
    if (b.apply) this.boons.push(b.id);
    this.say(`${b.name}.`);
    this.play('select');
    this.state = 'explore';
    this.scene = { title: this.floor.name, text: this.room.text };
    this.flushQueue();
  }

  // ---- rooms with choices ----------------------------------------------------------------
  openRest(r) {
    const s = this.s;
    this.state = 'rest';
    this.scene = { title: 'A stoop', text: 'A stoop in the middle of the mind, warm from the sun that isn’t there. You can sit for one thing.' };
    const heal = Math.ceil(s.maxHp * 0.4);
    this.choiceOpts = [
      { id: 'sit', label: 'Sit a while', sub: `heal ${heal}`, go: () => { s.hp = Math.min(s.maxHp, s.hp + heal); this.play('heart'); return `You sat. +${heal} Heart.`; } },
      { id: 'remember', label: 'Remember something', sub: '+1 Wit for good', go: () => { s.wit += 1; return 'You remembered how you used to say things. +1 Wit.'; } },
      { id: 'tag', label: 'Tag the wall', sub: '+8 experience', go: () => { this.gainXp(8); return 'You wrote your name where it will last a while.'; } },
    ];
  }

  openShop(r) {
    const s = this.s;
    this.state = 'shop';
    this.scene = { title: 'A bodega', text: 'A bodega in the mind. The cat behind the counter takes words. It has seen everything.' };
    const buy = (cost, fn) => () => { s.words -= cost; this.play('coin'); return fn(); };
    const ability = BOONS.filter((b) => !b.repeat && !this.has(b.id));
    this.choiceOpts = [
      { id: 'coffee', label: 'Coffee', sub: 'heal 10 · 4 words', stay: true, disabled: s.words < 4 || s.hp >= s.maxHp, go: buy(4, () => { s.hp = Math.min(s.maxHp, s.hp + 10); return 'Bad coffee. Good enough. +10 Heart.'; }) },
      { id: 'adj', label: 'A better adjective', sub: '+1 Wit · 8 words', stay: true, disabled: s.words < 8, go: buy(8, () => { s.wit += 1; return 'It fits you. +1 Wit.'; }) },
      { id: 'sandwich', label: 'A sandwich, wrapped', sub: '+4 Heart for good · 7 words', stay: true, disabled: s.words < 7, go: buy(7, () => { s.maxHp += 4; s.hp += 4; return 'The best sandwich in the borough. +4 Heart.'; }) },
      { id: 'comic', label: 'A comic about you', sub: 'a random new ability · 10 words', stay: true, disabled: s.words < 10 || !ability.length || this.boughtComic, go: buy(10, () => { const b = this.pick(ability); this.boons.push(b.id); this.boughtComic = true; return `Issue #1. You learn ${b.name}.`; }) },
      { id: 'leave', label: 'Leave', sub: 'the cat watches you go', go: () => 'The bell over the door rings once.' },
    ];
  }

  openEvent(r) {
    const pool = this.floor.events.filter((e) => !this.usedEvents.has(e));
    const id = pool.length ? this.pick(pool) : 'genre';
    this.usedEvents.add(id);
    this.state = 'event';
    const ev = EVENTS[id](this);
    this.scene = { title: ev.title, text: ev.text };
    this.choiceOpts = ev.choices.map((c, i) => ({ id: `ev:${i}`, ...c }));
  }

  // A chance roll the player can see the odds of before choosing.
  roll(p) { return this.r() < p; }
}

const LABEL = { fight: 'something hostile', event: 'something odd', treasure: 'something left behind', rest: 'a stoop', shop: 'a bodega', stairs: 'stairs down', boss: 'the last room', start: 'where you came in', empty: '' };
export const ROOM_WORD = { fight: 'foe', event: 'odd', treasure: 'loot', rest: 'stoop', shop: 'bodega', stairs: 'down', boss: 'PAGE', start: 'door', empty: '' };

// Odd rooms. Each returns a scene with choices; a choice's go() applies it and returns a line.
const EVENTS = {
  ending: (c) => {
    const p = c.check('wit', 4);
    return {
      title: 'A Sentence That Won’t End', text: 'In the middle of the room a sentence is walking in circles, and, and, and.',
      choices: [
        { label: 'Give it a period', sub: `Wit · ${pct(p)}`, go: () => (c.roll(p) ? (c.gainXp(8), 'It stops, grateful, and leaves you a semicolon as a tip. +8 experience.') : (c.s.hp -= 3, 'It keeps going, right through you. −3 Heart.')) },
        { label: 'Walk with it a while', sub: '+5 words', go: () => { c.s.words += 5; return 'You go around twice and pick up some words on the way. +5 words.'; } },
        { label: 'Leave it be', sub: '', go: () => 'Some sentences need to run on.' },
      ],
    };
  },
  draft: (c) => ({
    title: 'The Editor’s Desk', text: 'A red pen on a desk, and notes in the margins of a page about you.',
    choices: [
      { label: 'Take the notes', sub: '+1 Wit, −3 Heart for good', go: () => { c.s.wit += 1; c.s.maxHp -= 3; c.s.hp = Math.min(c.s.hp, c.s.maxHp); return 'Harsh, but fair. +1 Wit.'; } },
      { label: 'Rewrite your ending', sub: 'heal fully · 8 words', disabled: c.s.words < 8, go: () => { c.s.words -= 8; c.s.hp = c.s.maxHp; return 'You rewrite it. You come out of it fine this time.'; } },
      { label: 'Leave the pen', sub: '', go: () => 'You leave the pen where it is. It looks disappointed.' },
    ],
  }),
  mirror: (c) => {
    const p = c.check('nerve', 4);
    return {
      title: 'A Mirror Made of Paragraphs', text: 'Your reflection is described, not shown. The description is unflattering.',
      choices: [
        { label: 'Argue with it', sub: `Nerve · ${pct(p)}`, go: () => (c.roll(p) ? (c.s.nerve += 1, c.gainXp(4), 'It revises itself. +1 Nerve.') : (c.s.hp -= 3, 'It gets the last word. −3 Heart.')) },
        { label: 'Revise it', sub: '+4 Heart for good · 3 words', disabled: c.s.words < 3, go: () => { c.s.words -= 3; c.s.maxHp += 4; c.s.hp += 4; return 'Better. Not accurate, but better. +4 Heart.'; } },
        { label: 'Look away', sub: '', go: () => 'You were never much for mirrors.' },
      ],
    };
  },
  genre: (c) => ({
    title: 'A Door Marked GENRE', text: 'Behind it you can hear a car chase, a love story and a spaceship landing, all at once.',
    choices: [
      { label: 'Open it a crack', sub: '50%: a lot of experience, or a fight', go: () => { if (c.roll(c.chance(0.5))) { c.gainXp(12); return 'A whole other book blows through you. +12 experience.'; } c.startFight(c.pick(c.floor.foes), 'Something came out of the other genre.'); return 'Something came through the door.'; } },
      { label: 'Lock it', sub: '+2 experience', go: () => { c.gainXp(2); return 'One genre at a time.'; } },
    ],
  }),
  ring: (c) => ({
    title: 'A Ring on the Sidewalk', text: 'A ring lies in front of a stoop, like somebody left it there for you.',
    choices: [
      { label: 'Put it on', sub: c.has('ring') ? 'you already have one' : 'learn The Ring', disabled: c.has('ring'), go: () => { c.boons.push('ring'); c.play('ring'); return 'It fits. You feel lighter, and a little harder to see.'; } },
      { label: 'Leave it for the next kid', sub: '+10 experience', go: () => { c.gainXp(10); return 'Some things should stay where they happened.'; } },
    ],
  }),
  stoopball: (c) => {
    const p = c.check('nerve', 4);
    return {
      title: 'Stoop Ball', text: 'Kids are playing off the front steps. Hit the point of the step, they tell you, and it’s worth a hundred.',
      choices: [
        { label: 'Go for the point', sub: `Nerve · ${pct(p)}`, go: () => (c.roll(p) ? (c.s.words += 8, c.gainXp(6), 'A hundred points. They pay you in words. +8 words.') : (c.s.hp -= 2, 'It comes back and hits you in the face. Everyone saw. −2 Heart.')) },
        { label: 'Just watch', sub: '+3 experience', go: () => { c.gainXp(3); return 'You learn the rules. That counts for something.'; } },
      ],
    };
  },
  comics: (c) => {
    const ability = BOONS.filter((b) => !b.repeat && !c.has(b.id));
    return {
      title: 'A Comic Rack', text: 'The rack spins by itself. One of the issues is about you.',
      choices: [
        { label: 'Buy it', sub: 'a random new ability · 5 words', disabled: c.s.words < 5 || !ability.length, go: () => { c.s.words -= 5; const b = c.pick(ability); c.boons.push(b.id); return `In issue #1 you learn ${b.name}.`; } },
        { label: 'Read it standing up', sub: '+4 experience', go: () => { c.gainXp(4); return 'The guy at the counter clears his throat.'; } },
      ],
    };
  },
  client: (c) => {
    const p = c.check('wit', 6);
    return {
      title: 'A Client', text: 'A woman in a hat says her husband is missing, or her husband is a hat. The rain makes it hard to hear.',
      choices: [
        { label: 'Take the case', sub: `Wit · ${pct(p)}`, go: () => { if (c.roll(p)) { c.s.words += 6; c.gainXp(12); return 'You crack it. It was the hat. +6 words.'; } c.startFight('hood', 'The case had a hood in it.'); return 'The case had a hood in it.'; } },
        { label: 'Ask a question', sub: 'sure thing · −10 karma', go: () => { c.onKarma(-10); c.gainXp(8); return 'Questions cost karma here, but she answers. +8 experience.'; } },
        { label: 'Not my kind of case', sub: '', go: () => 'She goes back out into the rain.' },
      ],
    };
  },
  karma: (c) => ({
    title: 'The Karma Booth', text: 'A booth on the corner adjusts your karma for a fee. The attendant is a sheep in a cardigan.',
    choices: [
      { label: 'Buy karma', sub: '+30 karma · 6 words', disabled: c.s.words < 6, go: () => { c.s.words -= 6; c.onKarma(30); return 'The sheep stamps your card. +30 karma.'; } },
      { label: 'Sell karma', sub: '−30 karma · +8 words', go: () => { c.onKarma(-30); c.s.words += 8; return 'The sheep doesn’t judge. Out loud. +8 words.'; } },
      { label: 'Walk on', sub: '', go: () => 'The sheep goes back to its knitting.' },
    ],
  }),
  riff: (c) => {
    const p = c.check('wit', 5);
    return {
      title: 'A Man at the Bar', text: 'He can’t stop turning words over. “Rain, brain, brine,” he says. “Wait. I’ve got a better one.”',
      choices: [
        { label: 'Riff with him', sub: `Wit · ${pct(p)}`, go: () => { if (c.roll(p)) { if (!c.has('footnotes')) { c.boons.push('footnotes'); return 'You trade words until the bartender cuts you off. You learn Footnotes.'; } c.s.wit += 2; return 'You trade words all night. +2 Wit.'; } c.gainXp(3); return 'He out-riffs you. You learn something anyway.'; } },
        { label: 'Buy him a drink', sub: '+1 Nerve, see this floor · 3 words', disabled: c.s.words < 3, go: () => { c.s.words -= 3; c.s.nerve += 1; c.revealAll = true; return 'He draws you a map of this floor on a napkin. +1 Nerve.'; } },
      ],
    };
  },
  tiger: (c) => {
    const p = c.check('nerve', 6);
    return {
      title: 'Something Under the Floor', text: 'The floor bulges, striped, and moves on. The building pretends not to notice.',
      choices: [
        { label: 'Follow the stripes', sub: `Nerve · ${pct(p)}`, go: () => (c.roll(p) ? (c.s.words += 10, c.gainXp(8), 'It leads you to where the building keeps its words. +10 words.') : (c.s.hp -= 6, 'The floor opens. You climb back out. −6 Heart.')) },
        { label: 'Stand very still', sub: '+4 experience', go: () => { c.gainXp(4); return 'It passes. You were never here.'; } },
      ],
    };
  },
  radio: (c) => {
    const p = c.chance(0.5);
    return {
      title: 'The Radio That Remembers', text: 'A radio on a fence post plays a song you haven’t thought about in years.',
      choices: [
        { label: 'Listen to the end', sub: 'heal 10', go: () => { c.s.hp = Math.min(c.s.maxHp, c.s.hp + 10); return 'You let it play out. +10 Heart.'; } },
        { label: 'Change the station', sub: `${pct(p)}: +12 words, or −4 Heart`, go: () => (c.roll(p) ? (c.s.words += 12, 'A station that only plays words. +12 words.') : (c.s.hp -= 4, 'Static, all the way down. −4 Heart.')) },
      ],
    };
  },
  hole: (c) => ({
    title: 'A Hole That Wants Something', text: 'In the floor is a hole that isn’t empty, exactly. It’s selective. It looks at your words.',
    choices: [
      { label: 'Give it 6 words', sub: '+2 Wit', disabled: c.s.words < 6, go: () => { c.s.words -= 6; c.s.wit += 2; return 'It takes them and gives back an edge. +2 Wit.'; } },
      { label: 'Give it some Heart', sub: '−5 Heart for good, +2 Nerve', go: () => { c.s.maxHp -= 5; c.s.hp = Math.min(c.s.hp, c.s.maxHp); c.s.nerve += 2; return 'It takes it gently. You feel steadier and less. +2 Nerve.'; } },
      { label: 'Step around it', sub: '', go: () => 'It doesn’t want you. Try not to take it personally.' },
    ],
  }),
  vase: (c) => {
    const p = c.chance(0.55);
    return {
      title: 'A Vase You Can Barely See', text: 'On a table in a room full of fog there might be a vase.',
      choices: [
        { label: 'Reach for it', sub: `${pct(p)}: +6 Heart for good`, go: () => (c.roll(p) ? (c.s.maxHp += 6, c.s.hp += 6, 'You were holding it before you were sure it was there. +6 Heart.') : 'Your hand passes through. There was no vase. Or there was.') },
        { label: 'Leave it to the fog', sub: '+3 experience', go: () => { c.gainXp(3); return 'Some things are better described than held.'; } },
      ],
    };
  },
};
