import { mkdir, readFile, writeFile } from 'node:fs/promises';

const DATABASE_NAME = 'abyss-eater-profile';
const OUTPUT = 'dist/wrangler.production.jsonc';
const id = String(process.env.ABYSS_EATER_D1_DATABASE_ID || '').trim().toLowerCase();

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
  throw new Error('ABYSS_EATER_D1_DATABASE_ID must reference an existing D1 database UUID');
}

const raw = await readFile('wrangler.jsonc', 'utf8');
let config;
try {
  config = JSON.parse(raw);
} catch {
  throw new Error('wrangler.jsonc must remain strict JSON-compatible JSONC');
}

config.main = 'worker.mjs';

config.d1_databases = [{
  binding: 'PROFILE_DB',
  database_id: id,
  database_name: DATABASE_NAME,
  migrations_dir: '../migrations',
}];

await mkdir('dist', { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Rendered ${OUTPUT} with existing D1 database ${id}`);
