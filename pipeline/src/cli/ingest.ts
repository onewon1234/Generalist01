/**
 * ingest: run daily ingestion against live sources and report candidates.
 *   npx tsx src/cli/ingest.ts [--out ingest.json]
 * Read-only: no AI calls, no database writes. In GitHub Actions the summary is
 * also emitted as check-run annotations.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { httpFetch } from '../collect/http.ts';
import { loadRegistry } from '../collect/registry.ts';
import { ingest } from '../ingest/ingest.ts';

const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : undefined;
const res = await ingest(loadRegistry(), httpFetch, new Date());

const okSources = res.health.filter((h) => h.ok).length;
const c = res.counts;
const head = `ingest ${res.collectedAt}: ${okSources}/${res.health.length} active sources OK; collected ${c.collected}, noise ${c.noise}, undated ${c.undated}, stale ${c.stale}, future ${c.future} → fresh ${c.fresh} → ${c.clusters} clusters (${c.multiSource} with ≥2 publishers, ${c.liveBlogs} live-blog items)`;
const top = res.candidates.slice(0, 20).map((x, i) =>
  `${String(i + 1).padStart(2)}. [${x.publishers}p/${x.articles}a ${x.language} ${x.newest?.slice(5, 16) ?? '-'}Z] ${x.title} (${x.sources.join(',')})`);
const failed = res.health.filter((h) => !h.ok).map((h) => `${h.key}: ${h.error}`);
console.log([head, ...top, ...(failed.length ? ['failed sources:', ...failed] : [])].join('\n'));

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['### Ingest', head, '', '```', ...top, '```', ...failed.map((f) => `- ${f}`)].join('\n') + '\n');
if (process.env.GITHUB_ACTIONS) {
  const esc = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::notice title=ingest summary::${esc([head, `noise: ${JSON.stringify(res.noiseByReason)}`, ...failed].join('\n'))}`);
  console.log(`::notice title=ingest top candidates::${esc(top.join('\n'))}`);
}
if (out) writeFileSync(out, JSON.stringify(res, null, 2));
process.exit(okSources > 0 ? 0 : 1);
