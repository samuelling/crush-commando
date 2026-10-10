// The Deep Mind's interface: a map of rooms drawn in words, and a page with the scene and choices.
// Everything is a tap (or ◀ ▶ to move the highlight and jump to choose).
import { ROOM_WORD } from './crawl.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export class CrawlView {
  constructor(root, crawl, { onChange, sound }) {
    this.root = root; this.c = crawl; this.onChange = onChange; this.sound = sound;
    this.sel = -1;
    this.prev = { hp: crawl.s.hp, foeHp: null };
    root.innerHTML = `
      <div class="cw-top">
        <span class="cw-lv"></span><span class="cw-xp"><i></i></span>
        <span class="cw-stat cw-hp" title="Heart"></span>
        <span class="cw-stat cw-wit" title="Wit: how hard you hit"></span>
        <span class="cw-stat cw-nerve" title="Nerve: how much you can guard"></span>
        <span class="cw-stat cw-words" title="Words: spend them to riff, or at the bodega"></span>
        <span class="cw-boons"></span>
      </div>
      <div class="cw-body">
        <div class="cw-side">
          <div class="cw-floor"></div>
          <div class="cw-map"></div>
        </div>
        <div class="cw-page">
          <div class="cw-title"></div>
          <div class="cw-foe hidden"><div class="cw-foe-word"></div><div class="cw-foe-meta"><div class="cw-foe-name"></div><div class="cw-foe-bar"><i></i><span></span></div><div class="cw-intent"></div></div></div>
          <div class="cw-text"></div>
          <div class="cw-log"></div>
          <div class="cw-actions"></div>
        </div>
      </div>`;
    this.$ = (sel) => root.querySelector(sel);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b || b.disabled) return;
      if (this.sound) this.sound.unlock();
      this.choose(b.dataset.id);
    });
    this.render();
  }

  choose(id) {
    this.c.choose(id);
    this.sel = -1;
    this.render();
    this.onChange();
  }

  selectable() { return [...this.root.querySelectorAll('[data-id]:not([disabled])')]; }

  nav(dir) {
    const list = this.selectable();
    if (!list.length) return;
    this.sel = (this.sel + dir + list.length) % list.length;
    if (this.sel < 0) this.sel = 0;
    list.forEach((b, i) => b.classList.toggle('kb', i === this.sel));
  }

  activate() {
    const list = this.selectable();
    const b = list[Math.max(0, this.sel)];
    if (b) this.choose(b.dataset.id);
  }

  render() {
    const c = this.c, s = c.s;
    // top bar
    this.$('.cw-lv').textContent = `LV ${s.level}`;
    this.$('.cw-xp i').style.width = `${Math.min(100, (100 * s.xp) / (6 + s.level * 6))}%`;
    const hp = this.$('.cw-hp');
    hp.textContent = `♥ ${s.hp}/${s.maxHp}`;
    if (s.hp < this.prev.hp) { hp.classList.remove('ouch'); void hp.offsetWidth; hp.classList.add('ouch'); }
    this.prev.hp = s.hp;
    this.$('.cw-wit').textContent = `Wit ${s.wit}`;
    this.$('.cw-nerve').textContent = `Nerve ${s.nerve}`;
    this.$('.cw-words').textContent = `✦ ${s.words} words`;
    const names = c.boons.filter((b) => !['wit', 'nerve', 'heart'].includes(b));
    this.$('.cw-boons').textContent = names.length ? names.map((id) => ({ ring: 'Ring', second: 'Second Thought', wordplay: 'Wordplay', stoopball: 'Stoop Ball', collage: 'Collage', roo: 'Kangaroo', dime: 'Lucky Dime', footnotes: 'Footnotes', eyes: 'Night Eyes', insight: 'Insight' }[id] || id)).join(' · ') : '';
    this.$('.cw-floor').textContent = `${c.floor.name} · floor ${c.floorIdx + 1}/4`;

    this.renderMap();

    // the page
    this.$('.cw-title').textContent = c.scene.title;
    this.$('.cw-text').textContent = c.state === 'fight' ? c.foe.desc : c.scene.text;
    const foeBox = this.$('.cw-foe');
    if (c.state === 'fight') {
      const f = c.foe;
      foeBox.classList.remove('hidden');
      const word = this.$('.cw-foe-word');
      word.textContent = f.word;
      word.style.color = f.color;
      word.classList.toggle('boss', !!f.boss);
      if (this.prev.foeHp != null && f.hp < this.prev.foeHp) { word.classList.remove('hit'); void word.offsetWidth; word.classList.add('hit'); }
      this.prev.foeHp = f.hp;
      this.$('.cw-foe-name').textContent = [f.boss ? 'The last thing in the mind' : 'Standing in your way', f.block ? `guarding ${f.block}` : '', f.exposed ? 'exposed' : '', f.buff ? `+${f.buff} stronger` : ''].filter(Boolean).join('  ·  ');
      this.$('.cw-foe-bar i').style.width = `${Math.max(0, (100 * f.hp) / f.maxHp)}%`;
      this.$('.cw-foe-bar span').textContent = `${Math.max(0, f.hp)} / ${f.maxHp}`;
      this.$('.cw-intent').textContent = `Next: ${c.intentText()}`;
    } else {
      foeBox.classList.add('hidden');
      this.prev.foeHp = null;
    }
    const log = c.log.slice(-3);
    this.$('.cw-log').innerHTML = log.map((l, i) => `<p class="${i === log.length - 1 ? 'new' : ''}">${esc(l)}</p>`).join('');

    // choices (moving is done on the map)
    const opts = c.options().filter((o) => o.kind !== 'move');
    const box = this.$('.cw-actions');
    box.className = `cw-actions ${c.state}`;
    box.innerHTML = opts.map((o) => `<button data-id="${esc(o.id)}" ${o.disabled ? 'disabled' : ''}><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')
      + (c.state === 'explore' && !opts.length ? '<p class="cw-hint">Tap a glowing door on the map to explore.</p>' : '');
  }

  renderMap() {
    const c = this.c, W = c.map.W, H = c.map.H;
    const cells = c.cells();
    const at = {};
    for (const x of cells) at[`${x.x},${x.y}`] = x;
    let html = '';
    for (let gy = 0; gy < H * 2 - 1; gy++) {
      for (let gx = 0; gx < W * 2 - 1; gx++) {
        if (gx % 2 === 0 && gy % 2 === 0) {
          const r = at[`${gx / 2},${gy / 2}`];
          if (!r || !r.seen) { html += '<div class="cw-cell void"></div>'; continue; }
          const label = r.here ? 'you' : ROOM_WORD[r.type];
          const cls = ['cw-cell', r.here ? 'here' : '', r.visited ? 'visited' : 'unvisited', r.done && !r.here ? 'done' : '', `t-${r.type}`, r.canGo ? 'go' : ''].join(' ');
          html += r.canGo
            ? `<button class="${cls}" data-id="move:${r.key}" aria-label="${esc(label)}">${esc(label)}</button>`
            : `<div class="${cls}">${esc(label)}</div>`;
        } else if (gx % 2 === 1 && gy % 2 === 0) {
          const a = at[`${(gx - 1) / 2},${gy / 2}`], b = at[`${(gx + 1) / 2},${gy / 2}`];
          html += `<div class="cw-link h ${a && b && a.seen && b.seen && a.links.includes(b.key) ? 'on' : ''}"></div>`;
        } else if (gx % 2 === 0 && gy % 2 === 1) {
          const a = at[`${gx / 2},${(gy - 1) / 2}`], b = at[`${gx / 2},${(gy + 1) / 2}`];
          html += `<div class="cw-link v ${a && b && a.seen && b.seen && a.links.includes(b.key) ? 'on' : ''}"></div>`;
        } else html += '<div></div>';
      }
    }
    const map = this.$('.cw-map');
    map.style.gridTemplateColumns = Array.from({ length: W * 2 - 1 }, (_, i) => (i % 2 ? 'var(--cw-gap)' : 'var(--cw-cell)')).join(' ');
    map.style.gridTemplateRows = Array.from({ length: H * 2 - 1 }, (_, i) => (i % 2 ? 'var(--cw-gap)' : 'var(--cw-cellh)')).join(' ');
    map.innerHTML = html;
  }
}
