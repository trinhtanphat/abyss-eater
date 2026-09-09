import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_DIR = 'public';
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
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
  assets[routeFor(file)] = { body: await readFile(file, 'utf8'), contentType: contentTypeFor(file) };
}

function stripModuleSyntax(source) {
  return source
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/^export\s+async\s+function\s+/gm, 'async function ')
    .replace(/^export\s+function\s+/gm, 'function ');
}

function replaceRequired(source, marker, replacement) {
  if (!source.includes(marker)) throw new Error(`Missing build marker ${marker}`);
  return source.replace(marker, replacement);
}

const gameLogic = stripModuleSyntax(await readFile('src/game-logic.mjs', 'utf8'));
const world = stripModuleSyntax(await readFile('src/world.mjs', 'utf8'));
const wildlife = stripModuleSyntax(await readFile('src/wildlife.mjs', 'utf8'));
const protocol = stripModuleSyntax(await readFile('src/protocol.mjs', 'utf8'));
const spatialGrid = stripModuleSyntax(await readFile('src/spatial-grid.mjs', 'utf8'));
const roomState = stripModuleSyntax(await readFile('src/room-state.mjs', 'utf8'));
const progression = stripModuleSyntax(await readFile('src/progression.mjs', 'utf8'));
const sessionToken = stripModuleSyntax(await readFile('src/session-token.mjs', 'utf8'));
const profileStore = stripModuleSyntax(await readFile('src/profile-store.mjs', 'utf8'));

let template = await readFile('src/worker.template.mjs', 'utf8');
template = replaceRequired(template, '/*__GAME_LOGIC__*/', gameLogic);
template = replaceRequired(template, '/*__WORLD__*/', world);
template = replaceRequired(template, '/*__WILDLIFE__*/', wildlife);
template = replaceRequired(template, '/*__PROTOCOL__*/', protocol);
template = replaceRequired(template, '/*__SPATIAL_GRID__*/', spatialGrid);
template = replaceRequired(template, '/*__ROOM_STATE__*/', roomState);
template = replaceRequired(template, '/*__PROGRESSION__*/', progression);
template = replaceRequired(template, '/*__SESSION_TOKEN__*/', sessionToken);
template = replaceRequired(template, '/*__PROFILE_STORE__*/', profileStore);
template = replaceRequired(template, '/*__ASSETS__*/', JSON.stringify(assets));

await mkdir('dist', { recursive: true });
await writeFile('dist/worker.mjs', template);
console.log(`Built dist/worker.mjs (${Buffer.byteLength(template)} bytes, ${Object.keys(assets).length} assets)`);
