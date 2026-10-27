/**
 * read: print the permitted article text of one or more URLs for the
 * editor/writer stage (a Claude Code session on the user's subscription).
 *   npx tsx src/cli/read.ts <url> [<url> …]
 * Same rules as retrieval: robots.txt, noai/TDM opt-outs and paywall flags are
 * respected, and text is printed only for `read` pages. Nothing is written to
 * disk; run it locally, never in the public repository's Actions logs.
 */
import { httpFetch } from '../collect/http.ts';
import { hostOf } from '../collect/naver.ts';
import { RobotsCache } from '../research/robots.ts';
import { politeFetcher, readArticle } from '../research/retrieve.ts';

if (process.env.GITHUB_ACTIONS) { console.error('refusing to run in GitHub Actions (public logs)'); process.exit(2); }
const urls = process.argv.slice(2).filter((u) => /^https?:\/\//.test(u));
if (!urls.length) { console.error('usage: read <url> [<url> …]'); process.exit(2); }
const fetcher = politeFetcher(httpFetch, 1500);
const robots = new RobotsCache(fetcher);
for (const url of urls) {
  const language = /\.(kr)(\/|$)/.test(new URL(url).hostname + '/') ? 'ko' : 'en';
  const { record: r, paragraphs } = await readArticle({ url, title: '', publisher: hostOf(url), language, retrievedAt: new Date().toISOString() }, { fetcher, robots });
  console.log(`\n===== ${url}\nstatus: ${r.status}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ''} · robots: ${r.robots}${r.note ? ` · ${r.note}` : ''}`);
  console.log(`title: ${r.title ?? '-'}\npublished: ${r.pagePublishedAt ?? '-'} · modified: ${r.pageModifiedAt ?? '-'} · author: ${r.author ?? '-'} · retrieved: ${r.retrievedAt}`);
  if (r.status === 'read') paragraphs.forEach((p, i) => console.log(`[${i}] ${p}`));
}
