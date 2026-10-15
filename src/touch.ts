// On-screen controls for phones and tablets: drag on the game screen to walk, buttons below it.
import type { Action } from './game';

export interface TouchButton {
  id: string;
  label: string;
  a: Action;
  typed?: string;
  wide?: boolean;
}

const ROWS: TouchButton[][] = [
  [
    { id: 'music', label: '♪', a: 'mute' },
    { id: 'up', label: '▲', a: 'up' },
    { id: 'start', label: 'START', a: 'start', typed: 'Enter' },
  ],
  [
    { id: 'left', label: '◀', a: 'left' },
    { id: 'down', label: '▼', a: 'down' },
    { id: 'right', label: '▶', a: 'right' },
  ],
];

export interface TouchPanel {
  el: HTMLElement;
  update(musicOn: boolean): void;
}

/** Builds the touch panel on touch devices; returns it, or null elsewhere. */
export function setupTouch(onButton: (b: TouchButton, down: boolean) => void): TouchPanel | null {
  if (!matchMedia('(pointer: coarse)').matches) return null;
  const panel = document.createElement('div');
  panel.id = 'touch';
  let musicEl: HTMLButtonElement | null = null;

  for (const row of ROWS) {
    const r = document.createElement('div');
    r.className = 'row';
    for (const b of row) {
      const el = document.createElement('button');
      el.textContent = b.label;
      if (b.wide) el.classList.add('wide');
      const release = () => {
        el.classList.remove('on');
        onButton(b, false);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add('on');
        onButton(b, true);
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      if (b.id === 'music') musicEl = el;
      r.appendChild(el);
    }
    panel.appendChild(r);
  }
  document.body.appendChild(panel);
  document.body.classList.add('has-touch');

  let last: boolean | null = null;
  return {
    el: panel,
    update(musicOn) {
      if (musicOn === last || !musicEl) return;
      last = musicOn;
      musicEl.textContent = musicOn ? '♪' : '♪ OFF';
      musicEl.classList.toggle('off', !musicOn);
    },
  };
}

/**
 * A floating stick: put a finger down anywhere on `el` and drag; `onStick` gets the way to go
 * (each axis -1..1, 0 when the finger lifts). A short touch that hardly moves is a tap, at that
 * point in CSS pixels from `el`'s top-left corner.
 */
export function setupStick(
  el: HTMLElement,
  onStick: (x: number, y: number) => void,
  onTap: (x: number, y: number) => void,
) {
  const REACH = 28;
  let id = -1, ox = 0, oy = 0, t0 = 0, far = 0;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (id >= 0) return;
    id = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    t0 = performance.now();
    far = 0;
    el.setPointerCapture(id);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    far = Math.max(far, d);
    if (d < 5) return onStick(0, 0);
    // The origin trails the finger, so turning back is quick.
    if (d > REACH) {
      ox = e.clientX - (dx / d) * REACH;
      oy = e.clientY - (dy / d) * REACH;
    }
    const k = Math.min(1, d / REACH) / d;
    onStick(dx * k, dy * k);
  });
  for (const ev of ['pointerup', 'pointercancel'])
    el.addEventListener(ev, (e) => {
      const pe = e as PointerEvent;
      if (pe.pointerId !== id) return;
      id = -1;
      onStick(0, 0);
      if (ev === 'pointerup' && far < 10 && performance.now() - t0 < 300) {
        const r = el.getBoundingClientRect();
        onTap(pe.clientX - r.left, pe.clientY - r.top);
      }
    });
}
