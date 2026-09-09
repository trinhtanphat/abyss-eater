const TAU = Math.PI * 2;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDirection(direction) {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length <= 1 || length === 0) return direction;
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}

export function cameraRelativeDirection(axes = {}, yaw = 0, pitch = 0) {
  const forwardAmount = clamp(finite(axes.forward), -1, 1);
  const strafeAmount = clamp(finite(axes.strafe), -1, 1);
  const verticalAmount = clamp(finite(axes.vertical), -1, 1);
  const safeYaw = finite(yaw);
  const safePitch = finite(pitch);
  const cosPitch = Math.cos(safePitch);

  const forward = {
    x: -Math.sin(safeYaw) * cosPitch,
    y: Math.sin(safePitch),
    z: -Math.cos(safeYaw) * cosPitch,
  };
  const right = {
    x: Math.cos(safeYaw),
    y: 0,
    z: -Math.sin(safeYaw),
  };

  return normalizeDirection({
    x: forward.x * forwardAmount + right.x * strafeAmount,
    y: forward.y * forwardAmount + verticalAmount,
    z: forward.z * forwardAmount + right.z * strafeAmount,
  });
}

export function updateLook(look = {}, movementX = 0, movementY = 0, sensitivity = 0.0025, pitchLimit = Math.PI * 0.46) {
  const safeSensitivity = Math.max(0, finite(sensitivity));
  const safePitchLimit = clamp(Math.abs(finite(pitchLimit)), 0, Math.PI / 2 - 0.001);
  const rawYaw = finite(look.yaw) - finite(movementX) * safeSensitivity;
  const yaw = ((rawYaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const pitch = clamp(
    finite(look.pitch) - finite(movementY) * safeSensitivity,
    -safePitchLimit,
    safePitchLimit,
  );

  return { yaw, pitch };
}
