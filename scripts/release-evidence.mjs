import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cacheNameFrom(source) {
  return source.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1] || '';
}

export async function collectReleaseEvidence({
  workerPath = 'dist/worker.mjs',
  indexPath = 'public/index.html',
  swPath = 'public/sw.js',
  sourceSha = '',
} = {}) {
  const [worker, index, sw] = await Promise.all([
    readFile(workerPath), readFile(indexPath, 'utf8'), readFile(swPath, 'utf8'),
  ]);
  const resolvedSha = sourceSha || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
    sourceSha: resolvedSha,
    workerSha256: sha256(worker),
    workerBytes: worker.byteLength,
    shell: {
      cacheName: cacheNameFrom(sw),
      quickDive: index.includes('id="quick-dive-button"'),
      party: index.includes('id="party-code"'),
      chat: index.includes('id="chat-panel"'),
    },
  };
}

async function main() {
  const report = await collectReleaseEvidence();
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/release-evidence.json', `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
