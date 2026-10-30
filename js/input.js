import { clamp, damp } from './utils.js';

const KEY_ACTIONS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  KeyJ: 'attack',
  KeyZ: 'attack',
  KeyK: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyL: 'focus',
  KeyF: 'focus'
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.stick = { x: 0, y: 0, active: false, id: null, radius: 38 };
    this.stickVisual = { x: 0, y: 0 };
    this.tilt = new TiltControls();
    this.keyboard = false;
    this.buttonPointers = new Map();
    this.onFirstInput = null;
    this.bound = false;
  }

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) {
        e.preventDefault();
        if (!e.repeat) this.press(action);
        this.keyboard = true;
        this.onFirstInput?.();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        this.pressed.add('pause');
      }
      if (e.code === 'KeyM') {
        this.pressed.add('mute');
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) {
        e.preventDefault();
        this.release(action);
      }
    }, { passive: false });

    window.addEventListener('blur', () => this.clear());

    const zone = document.getElementById('stick-zone');
    const knob = document.getElementById('stick-knob');
    const base = zone?.querySelector('.stick-base');
    if (zone && knob && base) {
      const moveStick = (e) => {
        if (e.pointerId !== this.stick.id) return;
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const max = Math.max(20, rect.width * 0.34);
        const len = Math.hypot(dx, dy);
        if (len > max) {
          dx = dx / len * max;
          dy = dy / len * max;
        }
        const nx = dx / max;
        const ny = dy / max;
        this.stick.x = Math.abs(nx) < 0.12 ? 0 : nx;
        this.stick.y = Math.abs(ny) < 0.12 ? 0 : ny;
        this.stickVisual.x = dx;
        this.stickVisual.y = dy;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.onFirstInput?.();
      };

      zone.addEventListener('pointerdown', (e) => {
        if (this.stick.id !== null) return;
        this.stick.id = e.pointerId;
        this.stick.active = true;
        zone.setPointerCapture(e.pointerId);
        knob.classList.add('is-active');
        moveStick(e);
        e.preventDefault();
      });
      zone.addEventListener('pointermove', (e) => {
        if (e.pointerId === this.stick.id) {
          moveStick(e);
          e.preventDefault();
        }
      });
      const release = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.stick.id = null;
        this.stick.active = false;
        this.stick.x = 0;
        this.stick.y = 0;
        this.stickVisual.x = 0;
        this.stickVisual.y = 0;
        knob.style.transform = 'translate(0px, 0px)';
        knob.classList.remove('is-active');
        try { zone.releasePointerCapture(e.pointerId); } catch {}
      };
      zone.addEventListener('pointerup', release);
      zone.addEventListener('pointercancel', release);
      zone.addEventListener('lostpointercapture', release);
    }

    document.querySelectorAll('.touch-button').forEach((button) => {
      const action = button.dataset.action;
      if (!action) return;
      const down = (e) => {
        if (this.buttonPointers.has(e.pointerId)) return;
        this.buttonPointers.set(e.pointerId, { action, button });
        button.setPointerCapture(e.pointerId);
        button.classList.add('is-active');
        this.press(action);
        this.onFirstInput?.();
        e.preventDefault();
      };
      const up = (e) => {
        const data = this.buttonPointers.get(e.pointerId);
        if (!data) return;
        this.buttonPointers.delete(e.pointerId);
        data.button.classList.remove('is-active');
        this.release(data.action);
        try { data.button.releasePointerCapture(e.pointerId); } catch {}
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('lostpointercapture', up);
      button.addEventListener('contextmenu', e => e.preventDefault());
    });

    this.tilt.attach();
  }

  press(action) {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  release(action) {
    this.held.delete(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  isHeld(action) {
    return this.held.has(action);
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.stick.x = 0;
    this.stick.y = 0;
    this.stick.active = false;
    this.stick.id = null;
    this.stickVisual.x = 0;
    this.stickVisual.y = 0;
    const knob = document.getElementById('stick-knob');
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    this.buttonPointers.forEach(({ button }) => button.classList.remove('is-active'));
    this.buttonPointers.clear();
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;

    if (this.stick.active) {
      x = this.stick.x;
      y = this.stick.y;
    } else if (this.tilt.active && Math.abs(this.tilt.axis) > 0.1) {
      x = this.tilt.axis;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, len: Math.min(1, len) };
  }

  endFrame() {
    this.pressed.clear();
  }
}

export class TiltControls {
  constructor() {
    this.enabled = false;
    this.active = false;
    this.axis = 0;
    this.raw = 0;
    this.zero = null;
    this.status = 'off';
    this.lastEvent = 0;
    this.listening = false;
    this.onStatus = null;
    this.supported = typeof window !== 'undefined' && ('DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window);
    this.boundOrientation = (e) => this.onOrientation(e);
    this.boundMotion = (e) => this.onMotion(e);
    this.calibrateTimer = null;
  }

  attach() {
    window.addEventListener('resize', () => {
      if (this.enabled) this.zero = null;
    });
  }

  setStatus(status, detail = '') {
    this.status = status;
    this.onStatus?.(status, detail);
  }

  async enable() {
    if (this.enabled) return { ok: true, status: 'on' };
    if (!this.supported) {
      this.setStatus('unsupported');
      return { ok: false, status: 'unsupported' };
    }
    this.setStatus('requesting');
    try {
      const DOE = window.DeviceOrientationEvent;
      const DME = window.DeviceMotionEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        const permission = await DOE.requestPermission();
        if (permission !== 'granted') {
          this.setStatus('denied');
          return { ok: false, status: 'denied' };
        }
      }
      if (DME && typeof DME.requestPermission === 'function') {
        await DME.requestPermission().catch(() => {});
      }
    } catch (error) {
      this.setStatus('denied');
      return { ok: false, status: 'denied' };
    }

    this.enabled = true;
    this.zero = null;
    this.lastEvent = 0;
    this.active = false;
    this.axis = 0;
    window.addEventListener('deviceorientation', this.boundOrientation, true);
    window.addEventListener('devicemotion', this.boundMotion, true);
    this.listening = true;
    this.setStatus('on');
    clearTimeout(this.calibrateTimer);
    this.calibrateTimer = setTimeout(() => {
      if (this.enabled && this.lastEvent && performance.now() - this.lastEvent > 1600) {
        this.setStatus('no-events');
      }
    }, 1900);
    return { ok: true, status: 'on' };
  }

  disable() {
    this.enabled = false;
    this.active = false;
    this.axis = 0;
    this.raw = 0;
    this.zero = null;
    if (this.listening) {
      window.removeEventListener('deviceorientation', this.boundOrientation, true);
      window.removeEventListener('devicemotion', this.boundMotion, true);
      this.listening = false;
    }
    clearTimeout(this.calibrateTimer);
    this.setStatus('off');
  }

  orientationValue(e) {
    const angle = (screen.orientation && Number(screen.orientation.angle)) || window.orientation || 0;
    let value;
    if (Math.abs(angle) === 90) {
      value = angle > 0 ? -e.beta : e.beta;
    } else {
      value = e.gamma;
    }
    if (value == null || Number.isNaN(value)) return null;
    return value;
  }

  onOrientation(e) {
    if (!this.enabled) return;
    const value = this.orientationValue(e);
    if (value == null) return;
    this.ingest(value);
  }

  onMotion(e) {
    if (!this.enabled) return;
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null) return;
    const angle = (screen.orientation && Number(screen.orientation.angle)) || window.orientation || 0;
    const value = Math.abs(angle) === 90 ? acc.y * 5.7 : acc.x * 5.7;
    this.ingest(value);
  }

  ingest(value) {
    if (this.zero == null) this.zero = value;
    this.lastEvent = performance.now();
    this.active = true;
    const target = clamp((value - this.zero) / 22, -1, 1);
    this.raw = target;
    const dead = Math.abs(target) < 0.1 ? 0 : target;
    this.axis = damp(this.axis, dead, 10, 1 / 60);
  }
}
