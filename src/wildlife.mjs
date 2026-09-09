export const WILDLIFE_COUNT = 24;
export const WILDLIFE_STEP_MS = 250;

const MASS_TIERS = [0.45, 0.6, 0.7, 0.82, 1.05, 1.25, 1.5, 1.8, 2.4, 3.2, 4.6, 6.2];
const NAMES = ['Silver Fry', 'Reef Dart', 'Glass Minnow', 'Coral Runner', 'Blue Scout', 'Reef Grazer', 'Amber Snapper', 'Barracuda', 'Needle Hunter', 'Deep Fang', 'Abyss Hunter', 'Voidjaw'];
const MAX_STEP_SECONDS = 0.25;

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalized(vector) {
  const raw = {
    x: finite(vector?.x),
    y: finite(vector?.y),
    z: finite(vector?.z),
  };
  const length = Math.hypot(raw.x, raw.y, raw.z);
  if (length <= 1e-9) return { x: 1, y: 0, z: 0 };
  return { x: raw.x / length, y: raw.y / length, z: raw.z / length };
}

function seededHeading(seed, time = 0) {
  const phase = finite(seed) * 1.61803398875 + finite(time) * 0.00013;
  return normalized({
    x: Math.cos(phase),
    y: Math.sin(phase * 0.57) * 0.35,
    z: Math.sin(phase),
  });
}

function positionOf(value) {
  return value?.position || { x: 0, y: 0, z: 0 };
}

function distance3(a, b) {
  return Math.hypot(
    finite(a?.x) - finite(b?.x),
    finite(a?.y) - finite(b?.y),
    finite(a?.z) - finite(b?.z),
  );
}

function nearestMatching(actor, players, predicate, maxDistance) {
  let nearest = null;
  for (const player of Array.isArray(players) ? players : []) {
    if (!player?.position || !Number.isFinite(player.mass) || !predicate(player)) continue;
    const distance = distance3(actor.position, player.position);
    if (distance > maxDistance) continue;
    if (!nearest || distance < nearest.distance) nearest = { player, distance };
  }
  return nearest;
}

function speedForWildlife(mass) {
  const size = Math.cbrt(Math.max(0.2, finite(mass) || 1));
  return clamp(7.4 / size, 2.8, 8.4);
}

function tierFor(index) {
  const tierIndex = Math.abs(Math.trunc(index)) % MASS_TIERS.length;
  return { mass: MASS_TIERS[tierIndex], name: NAMES[tierIndex] };
}

export function makeWildlifePopulation(spawnPoint, idFactory) {
  const spawn = typeof spawnPoint === 'function' ? spawnPoint : () => ({ x: 0, y: 0, z: 0 });
  const makeId = typeof idFactory === 'function' ? idFactory : (() => {
    let id = 0;
    return () => `wild-${++id}`;
  })();
  return Array.from({ length: WILDLIFE_COUNT }, (_, index) => {
    const tier = tierFor(index);
    const seed = index + 1;
    return {
      id: String(makeId()),
      kind: 'wildlife',
      name: tier.name,
      mass: tier.mass,
      position: { ...spawn() },
      heading: seededHeading(seed),
      seed,
    };
  });
}

export function respawnWildlife(actor, spawnPoint) {
  const spawn = typeof spawnPoint === 'function' ? spawnPoint() : spawnPoint;
  const seed = Math.max(1, Math.trunc(finite(actor?.seed)) + 17);
  return {
    ...actor,
    kind: 'wildlife',
    position: {
      x: finite(spawn?.x),
      y: finite(spawn?.y),
      z: finite(spawn?.z),
    },
    heading: seededHeading(seed),
    seed,
  };
}

export function stepWildlife(population, players, dt, bounds, now = 0) {
  const step = clamp(finite(dt), 0, MAX_STEP_SECONDS);
  const safeBounds = {
    x: Math.max(1, Math.abs(finite(bounds?.x)) || 80),
    y: Math.max(1, Math.abs(finite(bounds?.y)) || 28),
    z: Math.max(1, Math.abs(finite(bounds?.z)) || 80),
  };

  return (Array.isArray(population) ? population : []).map((actor, index) => {
    const mass = Math.max(0.2, finite(actor?.mass) || 1);
    const position = positionOf(actor);
    const threat = nearestMatching(
      actor,
      players,
      (player) => player.mass >= mass * 1.15,
      22,
    );
    const prey = nearestMatching(
      actor,
      players,
      (player) => mass >= player.mass * 1.15,
      24,
    );

    let desired = seededHeading(finite(actor?.seed) || index + 1, now);
    if (threat && mass <= 1.5) {
      desired = normalized({
        x: finite(position.x) - finite(threat.player.position.x),
        y: finite(position.y) - finite(threat.player.position.y),
        z: finite(position.z) - finite(threat.player.position.z),
      });
    } else if (prey && mass >= 1.5) {
      desired = normalized({
        x: finite(prey.player.position.x) - finite(position.x),
        y: finite(prey.player.position.y) - finite(position.y),
        z: finite(prey.player.position.z) - finite(position.z),
      });
    } else if (actor?.heading) {
      const wander = seededHeading(finite(actor.seed) || index + 1, now);
      desired = normalized({
        x: finite(actor.heading.x) * 0.78 + wander.x * 0.22,
        y: finite(actor.heading.y) * 0.78 + wander.y * 0.22,
        z: finite(actor.heading.z) * 0.78 + wander.z * 0.22,
      });
    }

    const margin = Math.min(4, 0.12 * Math.min(safeBounds.x, safeBounds.y, safeBounds.z));
    if (Math.abs(finite(position.x)) > safeBounds.x - margin) desired.x -= Math.sign(finite(position.x)) * 1.4;
    if (Math.abs(finite(position.y)) > safeBounds.y - margin) desired.y -= Math.sign(finite(position.y)) * 1.4;
    if (Math.abs(finite(position.z)) > safeBounds.z - margin) desired.z -= Math.sign(finite(position.z)) * 1.4;
    desired = normalized(desired);

    const speed = speedForWildlife(mass);
    return {
      ...actor,
      kind: 'wildlife',
      mass,
      heading: desired,
      position: {
        x: clamp(finite(position.x) + desired.x * speed * step, -safeBounds.x, safeBounds.x),
        y: clamp(finite(position.y) + desired.y * speed * step, -safeBounds.y, safeBounds.y),
        z: clamp(finite(position.z) + desired.z * speed * step, -safeBounds.z, safeBounds.z),
      },
    };
  });
}
