/**
 * shots: full-page screenshots of a built site at desktop and mobile widths.
 *   npx tsx scripts/shots.ts <site-dir> [--out <dir>]
 * Uses Playwright when it is installed (it is in the Claude cloud workspace).
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const site = resolve(args[0] ?? '');
const outIdx = args.indexOf('--out');
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : join(site, 'shots'));
let playwright: any;
try { playwright = createRequire(import.meta.url)('playwright'); } catch {
  console.error('playwright is not installed here; run this where it is (npm i -D playwright, or the cloud workspace)');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const pages = ['index.html', ...readdirSync(join(site, 'articles')).filter((f) => f.endsWith('.html')).map((f) => `articles/${f}`)];
const browser = await playwright.chromium.launch();
for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1, colorScheme: 'light' });
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto('file://' + join(site, p));
    await page.waitForTimeout(150);
    const file = join(out, `${name}-${p.replace(/\//g, '_').replace(/\.html$/, '')}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();
