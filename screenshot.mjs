#!/usr/bin/env node
// Usage: node screenshot.mjs <url> [label] [--pick]
// Takes a mobile-sized screenshot. --pick clicks the first task in the picker modal.

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));

const url = positional[0];
const label = (positional[1] || 'screenshot').replace(/[^a-z0-9-]/gi, '-');

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label] [--pick]');
  process.exit(1);
}

const outDir = join(tmpdir(), 'bliep-shots');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${label}-${Date.now()}.png`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );

  // Pre-seed localStorage so picker modal is bypassed on --pick flag
  if (flags.has('--pick')) {
    await page.evaluateOnNewDocument(() => {
      const today = new Date().toISOString().split('T')[0];
      // Stub a chosen task — we need a valid task id though, so pick the
      // first one at runtime after loading the same deterministic helper.
      localStorage.setItem('bliep:onboarded', 'true');
    });
  } else {
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('bliep:onboarded', 'true');
    });
  }

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  await new Promise(r => setTimeout(r, 700));

  // Hide Next.js dev overlay so it doesn't cover the UI in screenshots
  await page.addStyleTag({
    content: `
      [data-next-mark], [data-nextjs-toast], nextjs-portal,
      #__next-build-watcher, #__next-prerender-indicator { display: none !important; visibility: hidden !important; }
    `,
  });

  if (flags.has('--pick')) {
    // Click the first task scroll (the first button inside the picker modal)
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Find a button whose SVG contains a parchment path
      const pickerBtn = btns.find(b => b.querySelector('svg rect[width="292"]'));
      if (pickerBtn) { pickerBtn.click(); return true; }
      return false;
    });
    if (clicked) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const buf = await page.screenshot({ type: 'png', fullPage: false });
  writeFileSync(outPath, buf);
  console.log(outPath);
} finally {
  await browser.close();
}
