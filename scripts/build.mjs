import { mkdir, readFile, writeFile } from 'node:fs/promises';

const assetFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/client-input.mjs': ['public/client-input.mjs', 'text/javascript; charset=utf-8'],
  '/styles.css': ['public/styles.css', 'text/css; charset=utf-8'],
  '/manifest.webmanifest': ['public/manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
  '/sw.js': ['public/sw.js', 'text/javascript; charset=utf-8'],
  '/icon-192.svg': ['public/icon-192.svg', 'image/svg+xml'],
  '/icon-512.svg': ['public/icon-512.svg', 'image/svg+xml'],
};

const assets = {};
for (const [route, [file, contentType]] of Object.entries(assetFiles)) {
  assets[route] = { body: await readFile(file, 'utf8'), contentType };
}

function stripExports(source) {
  return source
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+function\s+/gm, 'function ');
}

function replaceRequired(source, marker, replacement) {
  if (!source.includes(marker)) throw new Error(`Missing build marker ${marker}`);
  return source.replace(marker, replacement);
}

const gameLogic = stripExports(await readFile('src/game-logic.mjs', 'utf8'));
const protocol = stripExports(await readFile('src/protocol.mjs', 'utf8'));
const spatialGrid = stripExports(await readFile('src/spatial-grid.mjs', 'utf8'));
const roomState = stripExports(await readFile('src/room-state.mjs', 'utf8'));

let template = await readFile('src/worker.template.mjs', 'utf8');
template = replaceRequired(template, '/*__GAME_LOGIC__*/', gameLogic);
template = replaceRequired(template, '/*__PROTOCOL__*/', protocol);
template = replaceRequired(template, '/*__SPATIAL_GRID__*/', spatialGrid);
template = replaceRequired(template, '/*__ROOM_STATE__*/', roomState);
template = replaceRequired(template, '/*__ASSETS__*/', JSON.stringify(assets));

await mkdir('dist', { recursive: true });
await writeFile('dist/worker.mjs', template);
console.log(`Built dist/worker.mjs (${Buffer.byteLength(template)} bytes)`);
