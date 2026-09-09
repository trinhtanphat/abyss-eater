import { normalizePlanarInput } from './presentation.js';

const BLOCKED_CODES = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const INTERACTIVE_SELECTOR = 'input, select, button, textarea, a, [role="button"], [data-no-steer]';

export function createInputController({ canvas, joystick, joystickKnob, upButton, downButton, pointerToggle } = {}) {
  const keys = new Set();
  const vertical = new Set();
  let enabled = false;
  let pointerEnabled = true;
  let pointer = { x: 0, z: 0 };
  let stick = { x: 0, z: 0 };
  let stickPointerId = null;

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      keys.clear();
      vertical.clear();
      pointer = { x: 0, z: 0 };
      stick = { x: 0, z: 0 };
      if (joystickKnob) joystickKnob.style.transform = '';
    }
  }

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
  }

  function onKeyDown(event) {
    if (!enabled || isInteractiveTarget(event.target)) return;
    if (BLOCKED_CODES.has(event.code)) event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerMove(event) {
    if (!enabled || !pointerEnabled || event.pointerType === 'touch' || isInteractiveTarget(event.target)) return;
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    const dx = (event.clientX - width / 2) / (width * 0.36);
    const dz = (event.clientY - height / 2) / (height * 0.36);
    const deadZone = 0.13;
    const length = Math.hypot(dx, dz);
    if (length <= deadZone) {
      pointer = { x: 0, z: 0 };
      return;
    }
    const adjusted = (length - deadZone) / (1 - deadZone);
    const direction = normalizePlanarInput({ x: dx, z: dz });
    pointer = normalizePlanarInput({ x: direction.x * Math.min(1, adjusted), z: direction.z * Math.min(1, adjusted) });
  }

  function updateStick(event) {
    if (!joystick) return;
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(24, Math.min(rect.width, rect.height) * 0.36);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, radius / length);
    const px = dx * scale;
    const py = dy * scale;
    stick = normalizePlanarInput({ x: px / radius, z: py / radius });
    if (joystickKnob) joystickKnob.style.transform = `translate(${px}px, ${py}px)`;
  }

  function onStickDown(event) {
    if (!enabled || stickPointerId !== null) return;
    event.preventDefault();
    stickPointerId = event.pointerId;
    joystick?.setPointerCapture?.(event.pointerId);
    updateStick(event);
  }

  function onStickMove(event) {
    if (event.pointerId !== stickPointerId) return;
    event.preventDefault();
    updateStick(event);
  }

  function onStickEnd(event) {
    if (event.pointerId !== stickPointerId) return;
    event.preventDefault();
    stickPointerId = null;
    stick = { x: 0, z: 0 };
    if (joystickKnob) joystickKnob.style.transform = '';
  }

  function bindVertical(button, key) {
    if (!button) return () => {};
    const down = (event) => { if (enabled) { event.preventDefault(); vertical.add(key); } };
    const up = (event) => { event.preventDefault(); vertical.delete(key); };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
    return () => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointercancel', up);
      button.removeEventListener('pointerleave', up);
    };
  }

  function direction() {
    let x = 0;
    let z = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;

    let planar = normalizePlanarInput({ x, z });
    if (Math.hypot(stick.x, stick.z) > 0.02) planar = stick;
    else if (Math.hypot(planar.x, planar.z) < 0.02 && pointerEnabled) planar = pointer;

    let y = 0;
    if (keys.has('Space') || vertical.has('up')) y += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || vertical.has('down')) y -= 1;
    const length = Math.hypot(planar.x, y, planar.z);
    if (length > 1) return { x: planar.x / length, y: y / length, z: planar.z / length };
    return { x: planar.x, y, z: planar.z };
  }

  function syncPointerToggle() {
    pointerEnabled = pointerToggle ? Boolean(pointerToggle.checked) : true;
    if (!pointerEnabled) pointer = { x: 0, z: 0 };
  }

  addEventListener('keydown', onKeyDown, { passive: false });
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', () => { keys.clear(); vertical.clear(); pointer = { x: 0, z: 0 }; });
  canvas?.addEventListener('pointermove', onPointerMove, { passive: true });
  joystick?.addEventListener('pointerdown', onStickDown, { passive: false });
  joystick?.addEventListener('pointermove', onStickMove, { passive: false });
  joystick?.addEventListener('pointerup', onStickEnd, { passive: false });
  joystick?.addEventListener('pointercancel', onStickEnd, { passive: false });
  const unbindUp = bindVertical(upButton, 'up');
  const unbindDown = bindVertical(downButton, 'down');
  pointerToggle?.addEventListener('change', syncPointerToggle);
  syncPointerToggle();

  return {
    direction,
    setEnabled,
    setPointerEnabled(value) { pointerEnabled = Boolean(value); if (pointerToggle) pointerToggle.checked = pointerEnabled; },
    destroy() {
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      canvas?.removeEventListener('pointermove', onPointerMove);
      joystick?.removeEventListener('pointerdown', onStickDown);
      joystick?.removeEventListener('pointermove', onStickMove);
      joystick?.removeEventListener('pointerup', onStickEnd);
      joystick?.removeEventListener('pointercancel', onStickEnd);
      pointerToggle?.removeEventListener('change', syncPointerToggle);
      unbindUp();
      unbindDown();
    },
  };
}
