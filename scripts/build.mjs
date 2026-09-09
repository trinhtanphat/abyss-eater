import { mkdir, readFile, writeFile } from 'node:fs/promises';

const assetFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['public/styles.css', 'text/css; charset=utf-8'],
  '/manifest.webmanifest': ['public/manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
};

const assets = {};
for (const [route, [file, contentType]] of Object.entries(assetFiles)) {
  assets[route] = { body: await readFile(file, 'utf8'), contentType };
}

let gameLogic = await readFile('src/game-logic.mjs', 'utf8');
gameLogic = gameLogic
  .replace(/^export\s+const\s+/gm, 'const ')
  .replace(/^export\s+function\s+/gm, 'function ');

let template = await readFile('src/worker.template.mjs', 'utf8');
template = template
  .replace('/*__GAME_LOGIC__*/', gameLogic)
  .replace('/*__ASSETS__*/', JSON.stringify(assets));

await mkdir('dist', { recursive: true });
await writeFile('dist/worker.mjs', template);
console.log(`Built dist/worker.mjs (${Buffer.byteLength(template)} bytes)`);
