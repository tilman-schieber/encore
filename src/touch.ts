// Touch steering on the game screen: a floating stick that walks, and taps. The buttons below it
// are arcade-kit's.

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
