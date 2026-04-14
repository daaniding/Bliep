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

// poly.pizza serves CC-BY low-poly GLB assets at predictable URLs.
// These specific UUIDs are the models picked for the home scene.
const ASSETS = [
  // threejs.org examples — kept for reference, currently unused
  {
    url: 'https://threejs.org/examples/models/gltf/Soldier.glb',
    out: 'assets/3d/soldier.glb',
    note: 'three.js example Soldier (skinned mesh, animations) — currently unused, see procedural knight',
    minBytes: 1_000_000,
  },
  {
    url: 'https://threejs.org/examples/models/gltf/Horse.glb',
    out: 'assets/3d/horse.glb',
    note: 'three.js example Horse — currently unused',
    minBytes: 100_000,
  },
  // poly.pizza CC-BY assets — actively used
  {
    url: 'https://static.poly.pizza/dc22806e-b00a-4890-b988-f716b0342c9c.glb',
    out: 'assets/3d/castle.glb',
    note: 'poly.pizza castle — high-detail multi-building fortress (CC-BY)',
    minBytes: 1_000_000,
  },
  {
    url: 'https://static.poly.pizza/df68fe8a-c3ba-4800-a018-59fac6f3b444.glb',
    out: 'assets/3d/knight.glb',
    note: 'poly.pizza knight figure (CC-BY)',
    minBytes: 80_000,
  },
  {
    url: 'https://static.poly.pizza/f8a96f05-6835-411a-a98c-a9cd3d96951b.glb',
    out: 'assets/3d/house1.glb',
    note: 'poly.pizza medieval house variant 1 (CC-BY)',
    minBytes: 50_000,
  },
  {
    url: 'https://static.poly.pizza/89e11ad8-811d-4055-b041-12a959ac2973.glb',
    out: 'assets/3d/house2.glb',
    note: 'poly.pizza medieval house variant 2 (CC-BY)',
    minBytes: 50_000,
  },
  {
    url: 'https://static.poly.pizza/f5d3aefa-92d6-4d3e-af9f-211a7207ec7f.glb',
    out: 'assets/3d/tree1.glb',
    note: 'poly.pizza low-poly tree variant 1 (CC-BY)',
    minBytes: 30_000,
  },
  {
    url: 'https://static.poly.pizza/7bf15a15-bf15-45b1-8c9c-e0cd6259bf71.glb',
    out: 'assets/3d/tree2.glb',
    note: 'poly.pizza low-poly tree variant 2 (CC-BY)',
    minBytes: 20_000,
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
