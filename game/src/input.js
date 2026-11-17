// Glimmerhold — keyboard + mouse state. One job: turn device events into game input.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.rightDown = false;
    this.pressed = new Set(); // edge-triggered, consumed each frame
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouseDown = true; this.pressed.add('mouse0'); }
      if (e.button === 2) { this.rightDown = true; this.pressed.add('mouse2'); }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    };
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  down(key) { return this.keys.has(key); }

  wasPressed(key) { return this.pressed.has(key); }

  moveVector() {
    let x = 0, y = 0;
    if (this.down('a') || this.down('ArrowLeft')) x -= 1;
    if (this.down('d') || this.down('ArrowRight')) x += 1;
    if (this.down('w') || this.down('ArrowUp')) y -= 1;
    if (this.down('s') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  firing() { return this.mouseDown || this.down(' '); }

  endFrame() { this.pressed.clear(); }
}
