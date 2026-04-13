const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 512;

  // Background: dark bark with rounded corners
  const r = 100 * s;
  ctx.fillStyle = '#1C1410';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Warm radial glow
  const grad = ctx.createRadialGradient(
    size * 0.35, size * 0.35, 0,
    size * 0.5, size * 0.5, size * 0.6
  );
  grad.addColorStop(0, 'rgba(242, 140, 40, 0.12)');
  grad.addColorStop(1, 'rgba(196, 97, 58, 0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Amber notification dot
  const cx = size * 0.5;
  const cy = size * 0.38;
  const dotR = size * 0.16;

  // Glow
  ctx.shadowColor = 'rgba(242, 140, 40, 0.5)';
  ctx.shadowBlur = 30 * s;
  const circGrad = ctx.createRadialGradient(cx - dotR * 0.25, cy - dotR * 0.25, 0, cx, cy, dotR);
  circGrad.addColorStop(0, '#FFBF47');
  circGrad.addColorStop(1, '#F28C28');
  ctx.fillStyle = circGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // "bliep" text
  const fontSize = Math.round(68 * s);
  ctx.font = `600 ${fontSize}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  ctx.fillStyle = '#FBF7F2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${-1 * s}px`;
  ctx.fillText('bliep', size * 0.5, size * 0.58);

  // Three subtle dots at bottom
  const dotSize = 3.5 * s;
  const dotY = size * 0.82;
  const dotSpacing = 13 * s;
  ctx.fillStyle = 'rgba(242, 140, 40, 0.35)';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * dotSpacing, dotY, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${outputPath} (${buffer.length} bytes)`);
}

const publicDir = path.join(__dirname, 'public');
generateIcon(192, path.join(publicDir, 'icon-192.png'));
generateIcon(512, path.join(publicDir, 'icon-512.png'));
console.log('Done!');
