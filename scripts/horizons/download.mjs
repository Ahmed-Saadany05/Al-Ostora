/**
 * Download the coarse NASA PGDA maps once (80 m: 180 MB, 240 m: 209 MB) into a local cache
 * outside the repo / OneDrive. Resumes partial downloads. Dev-only.
 *
 *   node scripts/horizons/download.mjs
 * Cache dir: $REFAEY_DEM_CACHE or ~/.refaey-dem-cache
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { CACHE_DIR, LOCAL_KEYS, PRODUCTS, localPath } from './dem.mjs';

await mkdir(CACHE_DIR, { recursive: true });
for (const key of LOCAL_KEYS) {
  const { url } = PRODUCTS[key];
  const final = localPath(key);
  const part = `${final}.part`;
  const total = Number((await fetch(url, { method: 'HEAD' })).headers.get('content-length'));
  const done = await stat(final).then((s) => s.size).catch(() => -1);
  if (done === total) {
    console.log(`✓ ${key} already cached (${(total / 1048576).toFixed(0)} MB)`);
    continue;
  }
  for (let attempt = 1; attempt <= 8; attempt++) {
    const have = await stat(part).then((s) => s.size).catch(() => 0);
    if (have === total) break;
    try {
      console.log(`↓ ${key}: ${(have / 1048576).toFixed(0)}/${(total / 1048576).toFixed(0)} MB (attempt ${attempt})`);
      const res = await fetch(url, { headers: { Range: `bytes=${have}-` } });
      if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part, { flags: res.status === 206 ? 'a' : 'w' }));
    } catch (e) {
      console.log(`  retry after: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  const got = await stat(part).then((s) => s.size).catch(() => 0);
  if (got !== total) throw new Error(`${key}: incomplete download (${got}/${total})`);
  await rename(part, final);
  console.log(`✓ ${key} cached → ${final}`);
}
