import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/assets/defenders/knight/spritesheet.png";
const OUT = "public/assets/defenders/knight/rows";
const ROWS = 24;
const COLS = 6;

const meta = await sharp(SRC).metadata();
const rowH = Math.floor(meta.height / ROWS);
const W = meta.width;

await mkdir(OUT, { recursive: true });

for (let r = 0; r < ROWS; r++) {
  const out = path.join(OUT, `row_${r}.png`);
  await sharp(SRC)
    .extract({ left: 0, top: r * rowH, width: W, height: rowH })
    .toFile(out);
  console.log(`wrote ${out} (${W}x${rowH})`);
}

console.log(`done: ${ROWS} rows, ${COLS} cols, frame ${W / COLS}x${rowH}`);
