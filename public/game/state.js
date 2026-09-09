export function createClientState() {
  let clientId = null;
  let room = 'ocean-1';
  let bounds = { x: 80, y: 28, z: 80 };
  let snapshot = { players: [], food: [] };
  let previousLocal = null;

  function localPlayer(source = snapshot) {
    return source.players.find((player) => player.id === clientId) || null;
  }

  function welcome(message) {
    clientId = message?.id || null;
    room = message?.room || room;
    if (message?.bounds) bounds = { ...bounds, ...message.bounds };
    return applySnapshot(message?.snapshot || snapshot);
  }

  function applySnapshot(next) {
    if (!next || !Array.isArray(next.players) || !Array.isArray(next.food)) return null;
    const before = previousLocal;
    snapshot = next;
    const me = localPlayer();
    const changes = {
      me,
      previous: before,
      massDelta: me && before ? Number(me.mass || 0) - Number(before.mass || 0) : 0,
      scoreDelta: me && before ? Number(me.score || 0) - Number(before.score || 0) : 0,
      deathDelta: me && before ? Number(me.deaths || 0) - Number(before.deaths || 0) : 0,
    };
    previousLocal = me ? {
      id: me.id,
      mass: Number(me.mass || 0),
      score: Number(me.score || 0),
      deaths: Number(me.deaths || 0),
      position: { ...me.position },
    } : null;
    return changes;
  }

  function resetConnection() {
    clientId = null;
    previousLocal = null;
  }

  return {
    welcome,
    applySnapshot,
    localPlayer,
    resetConnection,
    get clientId() { return clientId; },
    get room() { return room; },
    get bounds() { return bounds; },
    get snapshot() { return snapshot; },
  };
}
