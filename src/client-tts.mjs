export const VIETNAMESE_VOICE_ID = 'vi_VN-vais1000-medium';
export const PIPER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm';

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function effectiveTtsGain(settings = {}) {
  return clamp01(settings.master) * clamp01(settings.tts);
}

export function createTtsController({
  getSettings = () => ({ ttsEnabled: false, master: 0, tts: 0 }),
  loadPiper = () => import(PIPER_MODULE_URL),
  AudioCtor = globalThis.Audio,
  speechSynthesis = globalThis.speechSynthesis,
  UtteranceCtor = globalThis.SpeechSynthesisUtterance,
  urlApi = globalThis.URL,
} = {}) {
  let piperPromise = null;
  let currentAudio = null;
  let currentUrl = null;
  let generation = 0;

  function enabled() {
    const settings = getSettings() || {};
    return settings.ttsEnabled === true && effectiveTtsGain(settings) > 0;
  }

  function gain() {
    return effectiveTtsGain(getSettings() || {});
  }

  function releaseAudio() {
    if (currentAudio) {
      try { currentAudio.pause?.(); } catch {}
      currentAudio.onended = null;
      currentAudio = null;
    }
    if (currentUrl) {
      try { urlApi?.revokeObjectURL?.(currentUrl); } catch {}
      currentUrl = null;
    }
  }

  function cancelNative() {
    try { speechSynthesis?.cancel?.(); } catch {}
  }

  function load() {
    if (!piperPromise) {
      piperPromise = Promise.resolve()
        .then(() => loadPiper())
        .catch((error) => {
          piperPromise = null;
          throw error;
        });
    }
    return piperPromise;
  }

  function speakNative(text) {
    if (!enabled()) return 'disabled';
    if (!speechSynthesis?.speak || typeof UtteranceCtor !== 'function') return 'unavailable';
    cancelNative();
    const utterance = new UtteranceCtor(text);
    utterance.lang = 'vi-VN';
    utterance.volume = gain();
    try {
      speechSynthesis.speak(utterance);
      return 'native';
    } catch {
      return 'unavailable';
    }
  }

  async function speak(value) {
    const text = String(value ?? '').trim();
    if (!text || !enabled()) return 'disabled';

    generation += 1;
    const token = generation;
    releaseAudio();
    cancelNative();

    try {
      const piper = await load();
      if (token !== generation || !enabled()) return 'cancelled';
      if (typeof piper?.predict !== 'function') throw new Error('Piper predict() unavailable');

      const wav = await piper.predict({ text, voiceId: VIETNAMESE_VOICE_ID });
      if (token !== generation || !enabled()) return 'cancelled';
      if (typeof AudioCtor !== 'function' || !urlApi?.createObjectURL) throw new Error('Browser audio unavailable');

      const objectUrl = urlApi.createObjectURL(wav);
      const audio = new AudioCtor();
      audio.src = objectUrl;
      audio.volume = gain();
      currentAudio = audio;
      currentUrl = objectUrl;
      audio.onended = () => {
        if (currentAudio !== audio) return;
        currentAudio = null;
        currentUrl = null;
        try { urlApi.revokeObjectURL(objectUrl); } catch {}
      };
      await audio.play();
      return 'piper';
    } catch {
      if (token !== generation || !enabled()) return 'cancelled';
      releaseAudio();
      return speakNative(text);
    }
  }

  function stop() {
    generation += 1;
    releaseAudio();
    cancelNative();
  }

  return { speak, stop, isEnabled: enabled };
}
