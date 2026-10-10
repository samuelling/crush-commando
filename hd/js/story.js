// The narrator. All text is original, written in homage to Jonathan Lethem's novels.
// Lines are short enough to read on a phone while running. Captions never pause play.
import { CHAPTERS, LAST_CHAPTER } from './chapters.js';

const hint = (text) => ({ hint: true, text });

export const SIGN_TEXT = {
  moon: 'THIS COUNTY DREAMS OF THE MOON',
  sunday: 'TIME RUNS ON SUNDAYS HERE',
  small: 'EVERYTHING HERE IS SMALLER THAN YOU REMEMBER',
  wind: 'THE WIND IS ON YOUR SIDE',
};

export const HEADLINES = [
  'FOG ENTERS FOURTH MONTH',
  'TIGER RUMORS DENIED AGAIN',
  'CITY HALL: “WHAT FOG?”',
  'STREET MISSING SINCE TUESDAY',
  'SKYLINE REPORTED SMALLER',
  'EXPERTS ADVISE: KEEP WALKING',
  'RARE VASE SOLD, NEVER SEEN',
  'RESIDENTS AGREE SOMETHING IS WRONG',
];

const LINES = [
  // Prologue: Genre. Almost silent. Someone starts paying attention.
  {
    checkpoint: ['Somewhere, somebody started taking notes.'],
    ambient: ['Every story starts out pretending to be some other kind of story.'],
  },
  // One: The Tail.
  {
    enter: [
      'It was raining the way it only rains in a certain kind of book.',
      'I’d been hired to tail a red smudge with two good legs and no plan. That’s you.',
      hint('In this town they keep score in karma. Fall, and the city docks you.'),
    ],
    checkpoint: [
      'I wrote down where you stopped. I write everything down.',
      'You paused under a streetlight. Amateur.',
      'Another flag. Another page in the file.',
    ],
    stomp: [
      'Hats off. Hat’s off. Hat soft. Sorry, I can’t leave a word alone.',
      'You flattened a fedora. The fedora had it coming.',
      'Down goes the hat man. Hatman. Manhat. Manhattan. No, we’re in Brooklyn.',
    ],
    fall: [
      'Down you went. Fifty karma. Fifty. Fifty-fifty. Fifth of fifty. Nifty.',
      'The gutter took you. The gutter always collects.',
      'Docked. Ducked. Dark. You fell, is what I mean.',
    ],
    hurt: ['That’s going to show up in the file.', 'Somebody in a hat doesn’t like you. Join the club.'],
    coin: ['Coins in the gutter. This town pays you to look down.', 'Small change. Small chance. Small chants. Keep running.'],
    low: ['One heart left, kid. One. Won. Wan. Run.'],
    ambient: [
      'Rain on the hat brim. Rain on the brim. Brim, brine, brain, rain.',
      'Asking questions costs karma here. So I don’t ask. I follow.',
      'Don’t look back. I’m the one back there.',
      'Every streetlight is a witness. None of them will talk.',
      'The case was simple. Where are you running, and why so fast?',
    ],
  },
  // Two: Stoop Ball.
  {
    enter: [
      'Then it was summer, nineteen seventy-something, and one block was the whole world.',
      'Every stoop had a kid on it, and every kid had an opinion about you.',
    ],
    ball: hint('A pink rubber ball. Land on it. Some things only work if you trust them.'),
    bounce: 'Higher than the second-floor windows. Nobody saw. Everybody saw.',
    checkpoint: [
      'You put your tag on the wall. Proof you were here, in letters nobody else can read.',
      'Tagged it. Somebody will paint over it. Somebody always does.',
      'Your name on the brick, sideways and proud.',
    ],
    stomp: ['The big kids will hear about that.', 'BOP. Like in the comics.', 'You won that one. Don’t get used to it.'],
    fall: ['Scraped knees heal. Mostly.', 'You fell, and the whole block saw, and the whole block will remember.'],
    hurt: ['That one’s going to bruise.', 'Some kid on a stoop is laughing at you.'],
    coin: ['Found money. A dime is a fortune on this block.', 'A quarter. That’s a slice and a soda, almost.'],
    low: ['One heart. Go home before the streetlights come on.'],
    ambient: [
      'Somebody’s radio is playing a song you’ll spend years trying to find again.',
      'The comic books said a person could fly. The comic books said a lot of things.',
      'Every kid on this block knows exactly where they’re not allowed to go.',
      'The block is changing. You won’t notice until it’s gone.',
    ],
  },
  // Three: Flight, Then Less.
  {
    enter: ['There was a ring on the sidewalk, like somebody left it there for you.'],
    ring: hint('The ring fit. Hold jump in the air to fly.'),
    flew: 'You flew. Not far, not long. Far enough.',
    turn: hint('Then the ring changed its mind. No more flying. Now nobody can see you, and nothing can touch you.'),
    ghost: 'They walk right through you now. You walk right through them.',
    checkpoint: ['Up on the roofline, the whole neighborhood looks like a comic panel.', 'Nobody on the block believes you. That’s how you know it’s real.'],
    checkpoint2: ['Your tag again. At least the wall can still see you.', 'You stopped, and nobody noticed. Nobody could.'],
    stomp: ['A hero would have done that with more style.', 'POW. You’ve read enough of these to know the sound effects.'],
    fall: ['Even the ring can’t catch everyone.', 'Gravity remembered you.'],
    hurt: ['Heroes take hits. That’s most of what heroes do.'],
    low: ['One heart left. The ring doesn’t fix everything.'],
    ambient: ['Every superpower comes with a catch the comic books leave out.', 'From up here the block looks smaller. So does everything else.'],
    ambient2: ['Being unseen is a kind of power. It’s also a kind of being alone.', 'Where did you go? I’m still writing, but I can’t find you on the page.'],
  },
  // Four: Dreamed Country.
  {
    enter: [
      'You left the ring in Brooklyn. Some things stay where they happened.',
      'Past the city, the country was being dreamed by whoever lived there. Read the signs.',
    ],
    moon: 'Someone here dreams about the moon. Jump.',
    sunday: 'Slow here. Somebody in this county is afraid of endings.',
    small: 'Everything shrank. Or you did. Hard to tell whose dream this is.',
    wind: 'The wind is at your back. Whoever dreams this place is kind.',
    checkpoint: ['A flag at the county line. The next dreamer’s rules start soon.', 'You stopped. The dream kept going without you.'],
    fall: ['You fell out of somebody’s dream. They’ll wake up and won’t remember you.', 'The ground was only dreamed. Dreams have holes.'],
    stomp: ['Somebody’s nightmare, flattened.'],
    hurt: ['Even in dreams, that stings.'],
    low: ['One heart. Try to wake up gently.'],
    ambient: [
      'Each town had a dreamer, each dreamer had a rule, and none of the rules agreed.',
      'The road kept rearranging itself behind you. You didn’t look.',
      'Out here the radio only plays what somebody is remembering.',
    ],
  },
  // Five: The Lack.
  {
    enter: ['Out on the salt flats there was a hole in things. Not in the ground. In everything.', '$taste'],
    taste: {
      coins: hint('It has a sweet tooth. Gold, mostly. Beat it to the coins.'),
      enemies: hint('It only wants the monsters. Stand back and let it eat.'),
      still: hint('It only takes what holds still. Keep moving.'),
      rising: hint('It only takes what’s on the way up. Don’t jump into it.'),
    },
    swallowed: ['It took you. It’s particular, and it was particular about you.', 'Into the hole. It spat you back at the last flag, the way it does.'],
    refused: 'It let you pass right through. It doesn’t want you. Try not to take it personally.',
    checkpoint: ['A flag in the salt. Nothing out here keeps its shape for long.'],
    stomp: ['One less thing for the hole to want.'],
    fall: ['The flats aren’t flat everywhere.'],
    hurt: ['Out here, even pain feels far away.'],
    low: ['One heart. The hole is patient.'],
    ambient: [
      'A scientist fell in love with this once. I’m not saying it went well.',
      'It isn’t empty. It’s selective.',
      'Somewhere past the horizon, a building hums with the experiment that made this.',
    ],
  },
  // Six: The Gray.
  {
    enter: ['The city again. A different city. The fog came in and didn’t leave.', 'The fog eats the skyline from the back. Keep moving.'],
    tiger: hint('Something big and striped is under the street. Watch for cracks.'),
    collapse: ['The street gave out. The tiger’s busy tonight.', 'Another hole. Nobody official will admit there’s a tiger.'],
    vase: 'A vase you could barely see. You weren’t sure it was there until you were holding it.',
    checkpoint: ['Everyone here is sure something is wrong, and no one can say what.', 'The headlines changed while you weren’t looking.'],
    fall: ['The gray took you. It’s patient.', 'The street opened, and the city pretended not to notice.'],
    stomp: ['Even the monsters here look tired.'],
    hurt: ['The city leaves marks you can’t see.'],
    low: ['One heart. Don’t let the fog get it.'],
    ambient: [
      'Somebody on the radio insists the fog is temporary. Has been insisting for months.',
      'It’s hard to say if the city is real, or only very well described.',
      'You can still see the next block. For now.',
    ],
  },
  // Seven: The Arrest.
  {
    enter: ['Then everything stopped working.', hint('The second jump was technology too. It’s gone. One jump. Choose it well.')],
    thin: 'The music is going. Let it go.',
    hud: 'The numbers fell off the world. You don’t need them.',
    silence: 'Quiet now. Just running. People used to do this for its own sake.',
    ending: 'There’s an ending up ahead. I can see it from here.',
    checkpoint: ['No score, no song. Only the next step.', 'You stopped to breathe. That still works.'],
    fall: ['You fell. Get up. That still works too.'],
    stomp: ['Even now, some things still want a fight.'],
    hurt: ['It hurts the old-fashioned way.'],
    low: ['One heart. It was always one heart.'],
  },
  // Epilogue: Influence.
  {
    enter: [
      'I should confess. Everything in this book was borrowed.',
      'The rain, the ring, the hole, the fog. I took them from better books, and I said so.',
      'That’s how it works. You take what you love and you make it run.',
      'This is the afterword. It goes on as long as you do.',
    ],
    checkpoint: ['Another page nobody asked for. Write it anyway.', 'A flag stitched together from every flag before it.'],
    fall: ['You fell in the afterword. Nobody reads these anyway.'],
    stomp: ['A fedora, a pigeon, a nightmare. All the monsters at once.'],
    ambient: [
      'Every sentence here has another sentence under it.',
      'Collage is just memory with the edges showing.',
      'You know all these places now. They were always the same place.',
    ],
  },
];

// The Mind: lines spoken while you are a figment inside the writer's head.
LINES.mind = {
  enter: [
    'You fell out of the story, and into the mind that was writing it.',
    hint('In here you’re a figment. Collect words. Get heavy enough and you’ll fall into a book.'),
    hint('Hold jump to drift. Ideas are light, at first.'),
  ],
  again: [
    'Out of the story again. In here, words are weight.',
    'Back in the mind. Gather what you can.',
    'You fell between the lines again. It’s warm in here.',
  ],
  stage1: 'A notion. Barely anything. Keep going.',
  stage2: 'An idea now. Still light enough to float.',
  stage3: 'A premise. It’s starting to have weight.',
  gravity: 'A story. It has gravity now. Let it fall.',
  cliche: ['A cliché. It cost you a word.', 'All of a sudden, at the end of the day, you lost a word.'],
  erased: ['Erased. The writer had second thoughts about you.', 'Struck out. Back to the page you came from.'],
  forgotten: ['Forgotten, which is a kind of mercy. Back to the page.', 'You slipped out of mind. It happens to the best ideas.'],
  ambient: [
    'Somewhere in here is every book that hasn’t been written yet.',
    'The margins are full of things that almost happened.',
    'Half these words belong to the book you fell out of. The other half are waiting for the next one.',
  ],
};

// The Deep Mind: lines for coming back out of the dungeon crawl.
LINES.crawl = {
  crawlWake: ['You woke up next to the door, in the field. The door is still open.', 'You came to in the grass. The mind let you go, for now. The door waits.'],
  crawlEnd: 'You came up out of the mind and onto the salt flats. Something out here is missing.',
};
Object.assign(LINES[4], LINES.crawl);

// Vocabulary for each book, used by the Mind. Single words and short phrases, nothing quoted.
export const WORDS = {
  genre: ['jump', 'coin', 'level', 'hero', 'run', 'flag', 'bonus', 'warp', 'secret', 'extra life', 'power-up', 'checkpoint', 'high score', 'boss', 'continue'],
  tail: ['rain', 'fedora', 'karma', 'gumshoe', 'alibi', 'streetlight', 'client', 'the case', 'trench coat', 'informant', 'gutter', 'question', 'the file', 'tail', 'neon'],
  stoop: ['stoop', 'pink ball', 'brownstone', 'summer', 'comics', 'tag', 'hydrant', 'the block', 'radio', 'dime', 'fire escape', 'soul record', 'skully', 'chalk', 'bodega'],
  flight: ['ring', 'flight', 'cape', 'rooftop', 'invisible', 'secret', 'sky', 'unseen', 'alone', 'power', 'the catch', 'hero', 'vanish', 'falling', 'wish'],
  dream: ['dream', 'county', 'moon', 'Sunday', 'dreamer', 'road', 'map', 'sign', 'rule', 'sleepwalk', 'horizon', 'amnesia', 'static', 'drive-in', 'mirage'],
  lack: ['void', 'hole', 'absence', 'physicist', 'particle', 'salt', 'flats', 'desire', 'nothing', 'selective', 'lab', 'taste', 'hunger', 'vacuum', 'longing'],
  gray: ['fog', 'tiger', 'vase', 'rumor', 'headline', 'skyline', 'haze', 'billboard', 'crack', 'the city', 'insomnia', 'smoke', 'apartment', 'gossip', 'gray'],
  arrest: ['silence', 'engine', 'stop', 'quiet', 'candle', 'bicycle', 'bread', 'barter', 'unplugged', 'stillness', 'well water', 'dusk', 'harvest', 'road', 'slow'],
  influence: ['collage', 'borrowed', 'echo', 'homage', 'sample', 'quote', 'influence', 'remix', 'palimpsest', 'scissors', 'glue', 'gift', 'theft', 'tribute', 'mixtape'],
  mind: ['maybe', 'almost', 'sentence', 'margin', 'draft', 'comma', 'paragraph', 'notebook', 'someday', 'what if', 'chapter', 'ellipsis', 'footnote', 'revision', 'page'],
};

// Sentence templates the Mind builds its platforms from. {a} and {b} are filled from the vocabulary.
export const SENTENCES = [
  'the {a} kept a {b} in its pocket',
  'nobody believed in the {a}',
  'every {a} is a kind of {b}',
  'somewhere a {a} was waiting',
  '{a}, then {b}, then less',
  'the {a} remembered the {b}',
  'it was mostly {a}',
  'a {a} with nowhere to go',
  'the {a} insisted on {b}',
  'call it {a}',
  'what if the {a} were {b}',
  'not {a} exactly, more like {b}',
];

export const CLICHES = [
  'all of a sudden', 'at the end of the day', 'a dark and stormy night', 'little did they know',
  'it was all a dream', 'only time will tell', 'in the nick of time',
];

const asLine = (l) => (typeof l === 'string' ? { text: l, hint: false } : l);

export class Story {
  constructor(ui) {
    this.ui = ui;
    this.enabled = readPref('hd_narration', '1') !== '0';
    this.reset(0);
  }

  setEnabled(v) {
    this.enabled = v;
    writePref('hd_narration', v ? '1' : '0');
    if (!v && this.cur && !this.cur.hint) this.clear();
  }

  reset(ci) {
    this.ci = ci;
    this.queue = [];
    this.cur = null;
    this.gap = 0;
    this.used = new Set();
    this.cool = 0;
    this.ambientT = 40;
    this.phase2 = false;
    this.timers = [];
    this.ui.caption(null);
  }

  clear() {
    this.queue = [];
    this.cur = null;
    this.timers = [];
    this.ui.caption(null);
  }

  get lines() { return LINES[this.ci] || {}; }

  say(line, front = false) {
    const l = asLine(line);
    if (!l || !l.text) return;
    if (!this.enabled && !l.hint) return;
    if (front) this.queue.unshift(l); else this.queue.push(l);
  }

  pick(name) {
    const L = this.lines;
    const pool = (this.phase2 && L[name + '2']) || L[name];
    if (!pool) return null;
    const fresh = pool.filter((t) => !this.used.has(t));
    if (!fresh.length) return null;
    const t = fresh[Math.floor(Math.random() * fresh.length)];
    this.used.add(t);
    return t;
  }

  // Reactive line for something that just happened. Skipped if the narrator is busy.
  event(name, chance = 1) {
    if (this.cool > 0 || this.cur || this.queue.length) return;
    if (Math.random() > chance) return;
    const t = this.pick(name);
    if (t) { this.say(t); this.cool = 7; }
  }

  // One-off story beat, shown once per run.
  special(key, override) {
    const id = `special:${this.ci}:${key}`;
    if (this.used.has(id)) return;
    const line = override || this.lines[key];
    if (!line) return;
    this.used.add(id);
    this.say(line, asLine(line).hint);
  }

  enterChapter(k, prev, ctx) {
    this.ci = k;
    this.phase2 = false;
    this.clear();
    const ch = CHAPTERS[k], pc = CHAPTERS[prev];
    const card = { after: pc && prev !== k ? pc.after : null, num: ch.num, title: ch.title };
    const queueEnter = () => {
      for (const l of this.lines.enter || []) this.say(l === '$taste' ? this.lines.taste[ctx.taste] : l);
    };
    this.ambientT = 32;
    if (k === LAST_CHAPTER) {
      this.ui.endCard(true);
      this.after(7, () => { this.ui.endCard(false); this.ui.chapterCard(card); });
      this.after(10, queueEnter);
    } else {
      this.ui.chapterCard(card);
      this.after(2.8, queueEnter);
    }
  }

  enterMind(first) {
    this.ci = 'mind';
    this.clear();
    for (const k of [...this.used]) if (k.startsWith('special:mind')) this.used.delete(k);
    this.ambientT = 24;
    if (first) for (const l of LINES.mind.enter) this.say(l);
    else this.say(LINES.mind.again[Math.floor(Math.random() * LINES.mind.again.length)]);
  }

  leaveMind(ci, line) {
    this.ci = ci;
    this.clear();
    if (line) this.say(line);
    this.ambientT = 30;
  }

  after(t, fn) { this.timers.push({ t, fn }); }

  update(dt) {
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) { tm.done = true; tm.fn(); } }
    this.timers = this.timers.filter((tm) => !tm.done);
    this.cool -= dt;
    if (this.cur) {
      const c = this.cur;
      c.t += dt;
      const n = Math.min(c.text.length, Math.floor(c.t * 48));
      const hold = 1.8 + c.text.length * 0.04;
      if (c.t > c.text.length / 48 + hold) {
        this.cur = null;
        this.gap = 0.7;
        this.ui.caption(null);
      } else this.ui.caption(c.text, n, c.hint);
      return;
    }
    if (this.gap > 0) { this.gap -= dt; return; }
    if (this.queue.length) { this.cur = { ...this.queue.shift(), t: 0 }; return; }
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 26 + Math.random() * 12;
      const t = this.pick('ambient');
      if (t) this.say(t);
    }
  }
}

export function readPref(k, def) {
  try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (_) { return def; }
}
export function writePref(k, v) {
  try { localStorage.setItem(k, v); } catch (_) { /* storage unavailable */ }
}
