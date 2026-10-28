/**
 * build: render an edition JSON into a static site.
 *   npx tsx src/build.ts <edition.json> --out <dir>
 * Writes index.html, articles/<slug>.html and style.css. Refuses to build an
 * edition with broken citations or links. Never deploys anything.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBriefs, checkHeadlines } from './checks.ts';
import { renderArticle, renderHome, validateEdition } from './render.ts';
import type { Edition } from './types.ts';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
const file = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1);
if (!file || !out) { console.error('usage: build <edition.json> --out <dir>'); process.exit(2); }
const e = JSON.parse(readFileSync(file, 'utf8')) as Edition;
const problems = validateEdition(e);
if (problems.length) { console.error('edition has problems:\n- ' + problems.join('\n- ')); process.exit(1); }
const notes = [...checkHeadlines(e).notes, ...checkBriefs(e).notes];
if (notes.length) console.log('notes for the editor:\n- ' + notes.join('\n- '));
mkdirSync(join(out, 'articles'), { recursive: true });
copyFileSync(join(import.meta.dirname, 'style.css'), join(out, 'style.css'));
writeFileSync(join(out, 'index.html'), renderHome(e));
for (const s of e.stories) writeFileSync(join(out, 'articles', `${s.slug}.html`), renderArticle(e, s));
console.log(`built ${e.stories.length} articles for ${e.date} → ${out}`);
