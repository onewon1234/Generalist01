/**
 * verify-sources: check candidate references before activation.
 *   npx tsx src/cli/verify-sources.ts [sources/candidates.json] [--out report.json]
 * For each candidate: the first feed URL that parses with dated items, then one
 * recent article read under the normal rules (robots.txt, noai/TDM opt-outs,
 * paywall flags). Discovery-only sources (video channels) are checked for the
 * feed only. Read-only: nothing is stored except the optional report.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeed } from '../collect/feed.ts';
import { httpFetch } from '../collect/http.ts';
import { RobotsCache } from '../research/robots.ts';
import { politeFetcher, readArticle } from '../research/retrieve.ts';

interface Candidate { key: string; name: string; homepage: string; urls: string[]; language: string; region: string; subject: string; reliabilityTier: 1 | 2 | 3; evergreen?: boolean; referenceOnly?: boolean }

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
const file = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1) ?? join(import.meta.dirname, '..', '..', '..', 'sources', 'candidates.json');
const { candidates } = JSON.parse(readFileSync(file, 'utf8')) as { candidates: Candidate[] };
const fetcher = politeFetcher(httpFetch, 1500);
const robots = new RobotsCache(fetcher);
const now = new Date();
const report: any[] = [];

for (const c of candidates) {
  const row: any = { key: c.key, name: c.name, referenceOnly: !!c.referenceOnly, feed: null, feedStatus: '', items: 0, dated: 0, newestAgeHours: null, sample: null };
  for (const url of c.urls) {
    const r = await fetcher(url, { timeoutMs: 20_000 });
    if (!r.ok) { row.feedStatus += `${url} → HTTP ${r.status}${r.error ? ` ${r.error}` : ''}; `; continue; }
    const f = parseFeed(r.body, { key: c.key, name: c.name, language: c.language, reliabilityTier: c.reliabilityTier }, now.toISOString());
    if (!f.articles.length) { row.feedStatus += `${url} → no items (${f.format ?? 'unknown format'}); `; continue; }
    const dated = f.articles.filter((a) => a.publishedAt);
    const newest = dated.map((a) => a.publishedAt!).sort().at(-1);
    Object.assign(row, { feed: url, feedStatus: row.feedStatus + 'ok', items: f.articles.length, dated: dated.length,
      newestAgeHours: newest ? Math.round((now.getTime() - Date.parse(newest)) / 36e5) : null,
      titles: f.articles.slice(0, 5).map((a) => a.title) });
    if (!c.referenceOnly) {
      const a = [...f.articles].sort((x, y) => (y.publishedAt ?? '').localeCompare(x.publishedAt ?? ''))[0];
      const { record } = await readArticle(a, { fetcher, robots });
      row.sample = { url: a.url, status: record.status, robots: record.robots, chars: record.textChars, note: record.note ?? null, restrictions: record.restrictions };
    }
    break;
  }
  row.verdict = !row.feed ? 'no working feed' : row.dated === 0 ? 'feed has no dates' : c.referenceOnly ? 'feed ok (discovery only)' : row.sample?.status === 'read' ? 'ok' : `article not readable: ${row.sample?.status}`;
  report.push(row);
  console.log(`${c.key.padEnd(22)} ${row.verdict.padEnd(36)} items=${row.items} dated=${row.dated} newest_h=${row.newestAgeHours ?? '-'} ${row.sample ? `sample=${row.sample.status}/${row.sample.robots}/${row.sample.chars}` : ''} ${row.feed ? '' : row.feedStatus}`);
}
if (out) writeFileSync(out, JSON.stringify({ checkedAt: now.toISOString(), report }, null, 2));
