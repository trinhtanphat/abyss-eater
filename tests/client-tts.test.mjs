import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('../src/client-tts.mjs', import.meta.url);

async function loadTtsModule() {
  assert.ok(existsSync(fileURLToPath(moduleUrl)), 'src/client-tts.mjs must exist');
  return import(moduleUrl.href);
}

test('Vietnamese TTS stays lazy while disabled', async () => {
  const { createTtsController } = await loadTtsModule();
  let loads = 0;
  const controller = createTtsController({
    getSettings: () => ({ ttsEnabled: false, master: 1, tts: 1 }),
    loadPiper: async () => { loads += 1; return {}; },
  });

  assert.equal(await controller.speak('Xin chào'), 'disabled');
  assert.equal(loads, 0, 'disabled TTS must not import Piper or download a model');
});

test('Piper uses the pinned Vietnamese voice and Master x TTS volume', async () => {
  const { createTtsController, VIETNAMESE_VOICE_ID, PIPER_MODULE_URL } = await loadTtsModule();
  const calls = [];
  const audios = [];
  const revoked = [];

  class FakeAudio {
    constructor() { this.volume = 1; this.src = ''; this.onended = null; audios.push(this); }
    async play() { this.played = true; }
    pause() { this.paused = true; }
  }

  const controller = createTtsController({
    getSettings: () => ({ ttsEnabled: true, master: 0.5, tts: 0.8 }),
    loadPiper: async () => ({
      predict: async (options) => { calls.push(options); return { kind: 'wav' }; },
    }),
    AudioCtor: FakeAudio,
    urlApi: {
      createObjectURL: () => 'blob:voice',
      revokeObjectURL: (url) => revoked.push(url),
    },
  });

  assert.equal(VIETNAMESE_VOICE_ID, 'vi_VN-vais1000-medium');
  assert.match(PIPER_MODULE_URL, /@mintplex-labs\/piper-tts-web@1\.0\.5/);
  assert.equal(await controller.speak('Cá lớn đã xuất hiện'), 'piper');
  assert.deepEqual(calls, [{ text: 'Cá lớn đã xuất hiện', voiceId: VIETNAMESE_VOICE_ID }]);
  assert.equal(audios.length, 1);
  assert.equal(audios[0].volume, 0.4);
  assert.equal(audios[0].src, 'blob:voice');
  assert.equal(audios[0].played, true);
  audios[0].onended?.();
  assert.deepEqual(revoked, ['blob:voice']);
});

test('Piper failure falls back to native vi-VN speech synthesis', async () => {
  const { createTtsController } = await loadTtsModule();
  const spoken = [];

  class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.volume = 1; }
  }

  const speechSynthesis = {
    cancel() {},
    speak(utterance) { spoken.push(utterance); },
  };

  const controller = createTtsController({
    getSettings: () => ({ ttsEnabled: true, master: 0.25, tts: 0.8 }),
    loadPiper: async () => { throw new Error('offline'); },
    speechSynthesis,
    UtteranceCtor: FakeUtterance,
  });

  assert.equal(await controller.speak('Đã kết nối'), 'native');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Đã kết nối');
  assert.equal(spoken[0].lang, 'vi-VN');
  assert.equal(spoken[0].volume, 0.2);
});

test('game wires Vietnamese TTS only to important events and shell v4', async () => {
  const [html, app, sw] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('public/sw.js', 'utf8'),
  ]);

  for (const marker of ['id="tts-enabled-setting"', 'id="tts-volume"', 'id="tts-volume-value"']) {
    assert.ok(html.includes(marker), `missing TTS setting: ${marker}`);
  }
  assert.ok(app.includes("import { createTtsController } from '/client-tts.mjs';"));
  assert.ok(app.includes('tts.speak(`Nuốt cá thành công.'), 'devouring another fish must be spoken');
  assert.ok(app.includes("tts.speak(message.resumed ? 'Đã kết nối lại với cá của bạn.' : 'Đã kết nối. Bạn đã vào đại dương.');"), 'connection must be spoken');
  assert.ok(app.includes('tts.speak(`Bạn đã bị ${message.by || \'một con cá lớn hơn\'} ăn. Đang hồi sinh.`);'), 'death must be spoken');
  assert.ok(app.indexOf('if (changes.scoreDelta >= 50)') < app.indexOf('tts.speak(`Nuốt cá thành công.'), 'TTS must stay inside the fish-devour threshold, not plankton events');
  assert.ok(sw.includes("const CACHE_NAME = 'abyss-eater-shell-v4';"));
  assert.ok(sw.includes("'/client-tts.mjs'"));
});
