export class Input {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  update() {
    this.prevKeys = { ...this.keys };
  }

  isDown(code) { return !!this.keys[code]; }
  justPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }

  get left() { return this.isDown('ArrowLeft') || this.isDown('KeyA'); }
  get right() { return this.isDown('ArrowRight') || this.isDown('KeyD'); }
  get up() { return this.isDown('ArrowUp') || this.isDown('KeyW'); }
  get down() { return this.isDown('ArrowDown') || this.isDown('KeyS'); }
  get jump() { return this.isDown('Space'); }
  get dig() { return this.isDown('KeyF') || this.isDown('KeyJ') || this.isDown('KeyK'); }
  get sprint() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }

  getState() {
    return {
      left: this.left,
      right: this.right,
      up: this.up,
      down: this.down,
      jump: this.jump,
      dig: this.dig,
      sprint: this.sprint,
    };
  }
}
