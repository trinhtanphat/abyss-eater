import { dangerLevel, growthProgress, leaderboard } from '../game/presentation.js';

function text(element, value) {
  if (element) element.textContent = String(value);
}

export function createHud(root = document) {
  const mass = root.querySelector('#hud-mass');
  const score = root.querySelector('#hud-score');
  const rank = root.querySelector('#hud-rank');
  const players = root.querySelector('#hud-players');
  const ping = root.querySelector('#hud-ping');
  const room = root.querySelector('#hud-room');
  const status = root.querySelector('#hud-status');
  const progress = root.querySelector('#growth-progress');
  const progressLabel = root.querySelector('#growth-label');
  const depth = root.querySelector('#depth-value');
  const depthMeter = root.querySelector('#depth-meter');
  const leaderboardRoot = root.querySelector('#leaderboard');
  const danger = root.querySelector('#danger-indicator');
  const dangerText = root.querySelector('#danger-text');

  function renderLeaderboard(rows) {
    if (!leaderboardRoot) return;
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const item = document.createElement('li');
      item.className = row.isLocal ? 'leader-row local' : 'leader-row';
      const place = document.createElement('span');
      place.className = 'leader-place';
      place.textContent = `#${row.rank}`;
      const name = document.createElement('span');
      name.className = 'leader-name';
      name.textContent = row.name;
      const value = document.createElement('strong');
      value.className = 'leader-score';
      value.textContent = String(row.score);
      item.append(place, name, value);
      fragment.append(item);
    });
    leaderboardRoot.replaceChildren(fragment);
  }

  function render({ snapshot = { players: [] }, clientId = null, bounds = { y: 28 }, room: roomName = 'ocean-1', pingMs = null, statusText = 'Ready', connected = false } = {}) {
    const list = Array.isArray(snapshot.players) ? snapshot.players : [];
    const me = list.find((player) => player.id === clientId) || null;
    const allRows = leaderboard(list, clientId, 10);
    const myRank = allRows.find((row) => row.id === clientId)?.rank || '—';
    const topRows = allRows.slice(0, 5);

    text(mass, me ? Number(me.mass || 1).toFixed(2) : '1.00');
    text(score, me ? Math.max(0, Math.round(Number(me.score) || 0)) : 0);
    text(rank, myRank === '—' ? '—' : `#${myRank}`);
    text(players, list.length);
    text(ping, pingMs === null ? '—' : `${Math.max(0, Math.round(pingMs))} ms`);
    text(room, roomName);
    text(status, statusText);

    const progressValue = growthProgress(me?.mass || 1);
    if (progress) progress.style.width = `${(progressValue * 100).toFixed(1)}%`;
    text(progressLabel, `${Math.round(progressValue * 100)}% evolution`);

    const topY = Math.max(1, Math.abs(Number(bounds?.y) || 28));
    const playerY = Number(me?.position?.y) || 0;
    const depthValue = Math.max(0, Math.round(topY - playerY));
    text(depth, `${depthValue} m`);
    if (depthMeter) {
      const ratio = Math.max(0, Math.min(1, depthValue / (topY * 2)));
      depthMeter.style.setProperty('--depth-ratio', ratio.toFixed(3));
      depthMeter.setAttribute('aria-valuenow', String(depthValue));
      depthMeter.setAttribute('aria-valuemax', String(Math.round(topY * 2)));
    }

    renderLeaderboard(topRows);
    const threat = dangerLevel(list, clientId, 28);
    if (danger) {
      danger.dataset.level = threat.level;
      danger.hidden = threat.level === 'safe';
    }
    if (threat.threat) {
      text(dangerText, `${threat.threat.name} · ${threat.threat.distance.toFixed(0)}m`);
    } else {
      text(dangerText, 'Water is clear');
    }

    document.body.classList.toggle('connected', connected);
    document.body.dataset.danger = threat.level;
    return threat;
  }

  return { render };
}
