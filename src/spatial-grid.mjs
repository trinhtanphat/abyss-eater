function validCellSize(cellSize) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError('cellSize must be positive');
  return cellSize;
}

function finiteCoordinate(value) {
  return Number.isFinite(value) ? value : 0;
}

function cellCoordinates(position = {}, cellSize) {
  const size = validCellSize(cellSize);
  return {
    x: Math.floor(finiteCoordinate(position.x) / size),
    y: Math.floor(finiteCoordinate(position.y) / size),
    z: Math.floor(finiteCoordinate(position.z) / size),
  };
}

export function cellKey(position, cellSize) {
  const cell = cellCoordinates(position, cellSize);
  return `${cell.x},${cell.y},${cell.z}`;
}

export function buildSpatialBuckets(items, cellSize, positionOf = (item) => item?.position) {
  validCellSize(cellSize);
  if (!Array.isArray(items)) return new Map();
  const buckets = new Map();
  for (const item of items) {
    const key = cellKey(positionOf(item), cellSize);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return buckets;
}

export function nearbyFromBuckets(buckets, position, cellSize) {
  validCellSize(cellSize);
  if (!(buckets instanceof Map)) return [];
  const center = cellCoordinates(position, cellSize);
  const seen = new Set();
  const nearby = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const bucket = buckets.get(`${center.x + dx},${center.y + dy},${center.z + dz}`) ?? [];
        for (const item of bucket) {
          if (seen.has(item)) continue;
          seen.add(item);
          nearby.push(item);
        }
      }
    }
  }
  return nearby;
}