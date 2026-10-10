// Keyboard + multi-touch input. The screen is split into three touch zones:
// left 30% = move left, next 25% = move right, right 45% = jump.
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK']);

export class Input {
  constructor(touchEl) {
    this.left = false;
    this.right = false;
    this.jumpHeld = false;
    this.jumpQueued = false;
    this.navQueued = 0;   // a left/right press, remembered until a menu reads it
    this.zones = { left: false, right: false, jump: false }; // touch-only, for drawing hints
    this.keys = new Set();
    this.pointers = new Map();
    this.onPause = null;
    this.onMute = null;
    this.onAny = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyP' || e.code === 'Escape') { this.onPause && this.onPause(); return; }
      if (e.code === 'KeyM') { this.onMute && this.onMute(); return; }
      if (LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code) || JUMP_KEYS.has(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
        if (JUMP_KEYS.has(e.code)) this.jumpQueued = true;
        if (LEFT_KEYS.has(e.code)) this.navQueued = -1;
        if (RIGHT_KEYS.has(e.code)) this.navQueued = 1;
        this.recompute();
        this.onAny && this.onAny();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.keys.delete(e.code)) this.recompute();
    });
    window.addEventListener('blur', () => this.reset());

    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { touchEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.recompute();
      this.onAny && this.onAny();
    };
    const move = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      this.recompute();
    };
    const up = (e) => {
      if (this.pointers.delete(e.pointerId)) this.recompute();
    };
    touchEl.addEventListener('pointerdown', down);
    touchEl.addEventListener('pointermove', move);
    touchEl.addEventListener('pointerup', up);
    touchEl.addEventListener('pointercancel', up);
    touchEl.addEventListener('lostpointercapture', up);
    touchEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  static zoneOf(x) {
    const f = x / window.innerWidth;
    return f < 0.3 ? 'left' : f < 0.55 ? 'right' : 'jump';
  }

  recompute() {
    const z = { left: false, right: false, jump: false };
    for (const p of this.pointers.values()) z[Input.zoneOf(p.x)] = true;
    if (z.left && !this.zones.left) this.navQueued = -1;
    if (z.right && !this.zones.right) this.navQueued = 1;
    this.zones = z;
    let l = z.left, r = z.right, j = z.jump;
    for (const k of this.keys) {
      if (LEFT_KEYS.has(k)) l = true;
      else if (RIGHT_KEYS.has(k)) r = true;
      else if (JUMP_KEYS.has(k)) j = true;
    }
    if (j && !this.jumpHeld) this.jumpQueued = true;
    this.left = l; this.right = r; this.jumpHeld = j;
  }

  get dir() { return (this.right ? 1 : 0) - (this.left ? 1 : 0); }

  consumeNav() {
    const n = this.navQueued;
    this.navQueued = 0;
    return n;
  }

  consumeJump() {
    const q = this.jumpQueued;
    this.jumpQueued = false;
    return q;
  }

  reset() {
    this.keys.clear();
    this.pointers.clear();
    this.jumpHeld = false;
    this.recompute();
    this.jumpQueued = false;
    this.navQueued = 0;
  }
}
