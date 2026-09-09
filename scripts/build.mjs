import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function routeFor(file) {
  const relative = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
  return relative === 'index.html' ? '/' : `/${relative}`;
}

function contentTypeFor(file) {
  return MIME_TYPES.get(path.extname(file).toLowerCase()) || 'application/octet-stream';
}

const assets = {};
for (const file of await listFiles(PUBLIC_DIR)) {
  assets[routeFor(file)] = {
    body: await readFile(file, 'utf8'),
    contentType: contentTypeFor(file),
  };
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
console.log(`Built dist/worker.mjs (${Buffer.byteLength(template)} bytes, ${Object.keys(assets).length} assets)`);
