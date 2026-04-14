#!/usr/bin/env node
/**
 * Fetch the GLB models we need for the home 3D kingdom scene.
 *
 * Sources:
 *   - threejs.org/examples — the canonical "Soldier" + "Horse" GLB
 *     models that ship with three.js examples. Licensed for use,
 *     including via three.js documentation (the Soldier is from
 *     Mixamo and the Horse is a classic three.js example asset).
 *
 * The script is idempotent — it skips files that already exist with
 * the right size. Run via `npm run fetch-assets`.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

const ASSETS = [
  {
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    out: 'assets/3d/soldier.glb',
    note: 'Mixamo soldier with Idle/Walk/Run animations — used as knight + villagers',
    minBytes: 1_000_000,
  },
  {
    url: 'https://threejs.org/examples/models/gltf/Horse.glb',
    out: 'assets/3d/horse.glb',
    note: 'Three.js example horse with walk animation',
    minBytes: 100_000,
  },
];

async function exists(p) {
  try {
    const s = await stat(p);
    return s.isFile() ? s.size : 0;
  } catch {
    return 0;
  }
}

async function fetchOne(asset) {
  const dest = resolve(PUBLIC, asset.out);
  await mkdir(dirname(dest), { recursive: true });

  const existing = await exists(dest);
  if (existing >= asset.minBytes) {
    console.log(`  ✓ skip (${(existing / 1024).toFixed(0)}KB exists): ${asset.out}`);
    return;
  }

  console.log(`  ↓ ${asset.url}`);
  const res = await fetch(asset.url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${asset.url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < asset.minBytes) {
    throw new Error(`Downloaded ${asset.url} is only ${buf.length} bytes (expected ≥ ${asset.minBytes})`);
  }
  await writeFile(dest, buf);
  console.log(`    → ${asset.out}  (${(buf.length / 1024).toFixed(0)}KB)`);
  console.log(`    license: ${asset.note}`);
}

async function main() {
  console.log(`\nFetching 3D assets into ${resolve(PUBLIC, 'assets/3d')}\n`);
  for (const asset of ASSETS) {
    try {
      await fetchOne(asset);
    } catch (err) {
      console.error(`  ✗ ${asset.out}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  console.log('\nDone.\n');
}

main();
