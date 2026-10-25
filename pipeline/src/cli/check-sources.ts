/**
 * check-sources: fetch every registry source live and report health.
 *   npx tsx src/cli/check-sources.ts [--out report.json]
 * Writes a JSON report (and a Markdown table to $GITHUB_STEP_SUMMARY in CI).
 * Exit code 1 only if no source works at all. Read-only: changes nothing.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { collect } from '../collect/collect.ts';
import { httpFetch } from '../collect/http.ts';
import { loadRegistry } from '../collect/registry.ts';

const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : undefined;
const now = new Date();
const sources = loadRegistry();
const res = await collect(sources, httpFetch, now);

const rows = res.health.map((h) => `| ${h.key} | ${h.kind} | ${h.ok ? 'OK' : 'FAIL'} | ${h.status} | ${h.format ?? ''} | ${h.items} | ${h.dated} | ${h.newestAgeHours ?? ''} | ${h.error ?? ''} |`);
const md = [
  `### Source check ${res.collectedAt}`,
  '',
  `${res.health.filter((h) => h.ok).length}/${res.health.length} sources OK, ${res.articles.length} unique articles.`,
  '',
  '| key | kind | result | HTTP | format | items | dated | newest (h) | error |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows,
].join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
if (out) writeFileSync(out, JSON.stringify({ collectedAt: res.collectedAt, health: res.health, sample: res.articles.slice(0, 50) }, null, 2));
process.exit(res.health.some((h) => h.ok) ? 0 : 1);
