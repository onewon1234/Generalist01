/**
 * headline-study: collect published headlines, decks and subheadings from the
 * study list (sources/headline-study.json) for editorial analysis.
 *   npx tsx src/cli/headline-study.ts --out <file.json> [--per-feed 4]
 * Feed titles and descriptions are read for every item; a few recent articles
 * per feed are opened under the normal access rules (robots.txt, opt-outs,
 * paywalls) to record their deck and subheadings. Body text is not kept.
 * Private output: run locally, never in the public repository's Actions logs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFeed } from '../collect/feed.ts';
import { httpFetch } from '../collect/http.ts';
import { RobotsCache } from '../research/robots.ts';
import { politeFetcher, readArticle } from '../research/retrieve.ts';

if (process.env.GITHUB_ACTIONS) { console.error('refusing to run in GitHub Actions (public logs)'); process.exit(2); }
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const out = arg('--out');
const perFeed = Number(arg('--per-feed') ?? 4);
if (!out) { console.error('usage: headline-study --out <file.json>'); process.exit(2); }
const { feeds } = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'sources', 'headline-study.json'), 'utf8')) as { feeds: { name: string; kind: string; url: string }[] };
const fetcher = politeFetcher(httpFetch, 1500);
const robots = new RobotsCache(fetcher);
const now = new Date().toISOString();
const result: any[] = [];
await Promise.all(feeds.map(async (f) => {
  const row: any = { name: f.name, kind: f.kind, feed: f.url, ok: false, items: [], articles: [] };
  const r = await fetcher(f.url, { timeoutMs: 20_000 });
  if (!r.ok) { row.error = `HTTP ${r.status}${r.error ? ` ${r.error}` : ''}`; result.push(row); return; }
  const language = /[가-힣]/.test(f.name) ? 'ko' : 'en';
  const parsed = parseFeed(r.body, { key: f.name, name: f.name, language, reliabilityTier: 2 }, now);
  row.ok = parsed.articles.length > 0;
  row.items = parsed.articles.slice(0, 30).map((a) => ({ title: a.title, excerpt: a.excerpt?.slice(0, 220) ?? null, url: a.url }));
  for (const a of parsed.articles.slice(0, perFeed)) {
    const res = await readArticle(a, { fetcher, robots });
    row.articles.push({ url: a.url, title: res.record.title ?? a.title, status: res.record.status, deck: res.description ?? null, subheads: res.subheads ?? [], chars: res.record.textChars });
  }
  result.push(row);
  console.log(`${f.name}: ${row.ok ? row.items.length + ' items' : row.error ?? 'no items'}; articles ${row.articles.map((x: any) => `${x.status}/${x.subheads.length}h`).join(' ')}`);
}));
writeFileSync(out, JSON.stringify({ collectedAt: now, feeds: result }, null, 2));
