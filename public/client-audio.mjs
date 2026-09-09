function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function effectiveGain(master, channel) {
  if (!Number.isFinite(master) || !Number.isFinite(channel)) return 0;
  return clamp01(clamp01(master) * clamp01(channel));
}

export function createAudioController({ getSettings = () => ({ master: 0, music: 0, sfx: 0 }) } = {}) {
  let context = null;
  let ambience = null;
  let suspended = false;

  function audioConstructor() {
    return globalThis.AudioContext || globalThis.webkitAudioContext || null;
  }

  function channelGain(channel) {
    const settings = getSettings() || {};
    return effectiveGain(settings.master, settings[channel]);
  }

  async function unlock() {
    const AudioContextCtor = audioConstructor();
    if (!AudioContextCtor) return false;
    if (!context) context = new AudioContextCtor();
    if (context.state === 'suspended') {
      try { await context.resume(); } catch { return false; }
    }
    suspended = false;
    return true;
  }

  function playTone(frequency, duration, volume, type = 'sine') {
    if (!context || suspended || context.state !== 'running') return;
    const gainValue = channelGain('sfx') * clamp01(volume);
    if (gainValue <= 0) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function stopAmbience() {
    if (!ambience) return;
    for (const oscillator of ambience.oscillators) {
      try { oscillator.stop(); } catch {}
      oscillator.disconnect();
    }
    ambience.gain.disconnect();
    ambience = null;
  }

  function startAmbience() {
    if (!context || suspended || context.state !== 'running' || ambience) return;
    const gainValue = channelGain('music') * 0.035;
    if (gainValue <= 0) return;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, context.currentTime);
    gain.connect(context.destination);
    const oscillators = [42, 58].map((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.connect(gain);
      oscillator.start();
      return oscillator;
    });
    ambience = { gain, oscillators };
  }

  async function setSuspended(value) {
    suspended = value === true;
    if (!context) return;
    if (suspended) {
      stopAmbience();
      if (context.state === 'running') {
        try { await context.suspend(); } catch {}
      }
      return;
    }
    if (context.state === 'suspended') {
      try { await context.resume(); } catch { return; }
    }
    startAmbience();
  }

  return {
    unlock,
    setSuspended,
    playUi() { playTone(520, 0.07, 0.12, 'sine'); },
    playEat() { playTone(760, 0.11, 0.16, 'triangle'); },
    playDeath() { playTone(150, 0.32, 0.2, 'sawtooth'); },
    startAmbience,
    stopAmbience,
  };
}
