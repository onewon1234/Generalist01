/**
 * site: build the public website from all published editions.
 *   npx tsx src/site.ts <editions-dir> --out <dir> [--base https://…/]
 * Each edition lives at /<date>/ (index.html, articles/<slug>.html, style.css)
 * so links in an email keep working forever. The root redirects to the newest
 * edition; /archive.html lists all of them. robots.txt disallows indexing until
 * search visibility is separately approved. Every edition must pass
 * validateEdition, or nothing is built.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc, koreanDate, renderArticle, renderHome, validateEdition } from './render.ts';
import type { Edition } from './types.ts';

export function loadEditions(dir: string): Edition[] {
  return readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Edition);
}

export function rootPage(latest: Edition): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Generalist Daily</title>
<meta http-equiv="refresh" content="0; url=./${esc(latest.date)}/"><link rel="canonical" href="./${esc(latest.date)}/"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f6f2;color:#1d2420;padding:2rem"><p><a href="./${esc(latest.date)}/">${koreanDate(latest.date)} Generalist Daily 읽기</a></p></body></html>
`;
}

export function archivePage(editions: Edition[]): string {
  const rows = [...editions].reverse().map((e) => `<li><a href="./${esc(e.date)}/">${koreanDate(e.date)}</a><span>${esc(e.stories[0]?.headline ?? '')}</span></li>`).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>지난 판 — Generalist Daily</title>
<style>body{font-family:"Noto Serif KR",serif;background:#f5f6f2;color:#1d2420;margin:0}main{width:min(100% - 2rem,46rem);margin:auto;padding:2rem 0}
a{color:#1d2420}h1{font-size:1.6rem}li{padding:.7rem 0;border-top:1px solid #d9dcd5;list-style:none;display:grid;gap:.2rem}ul{padding:0}span{color:#5b625d;font-size:.95rem}</style></head>
<body><main><p><a href="./">Generalist Daily</a></p><h1>지난 판</h1><ul>${rows}</ul></main></body></html>
`;
}

export function buildSite(editions: Edition[], out: string): string[] {
  const problems = editions.flatMap((e) => validateEdition(e).map((p) => `${e.date}: ${p}`));
  if (problems.length) return problems;
  mkdirSync(out, { recursive: true });
  for (const e of editions) {
    const dir = join(out, e.date);
    mkdirSync(join(dir, 'articles'), { recursive: true });
    copyFileSync(join(import.meta.dirname, 'style.css'), join(dir, 'style.css'));
    writeFileSync(join(dir, 'index.html'), renderHome(e));
    for (const s of e.stories) writeFileSync(join(dir, 'articles', `${s.slug}.html`), renderArticle(e, s));
  }
  const latest = editions.at(-1);
  if (latest) writeFileSync(join(out, 'index.html'), rootPage(latest));
  writeFileSync(join(out, 'archive.html'), archivePage(editions));
  writeFileSync(join(out, 'robots.txt'), editions.some((e) => e.indexable) ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  writeFileSync(join(out, '.nojekyll'), '');
  return [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const dir = args[0], out = outIdx >= 0 ? args[outIdx + 1] : undefined;
  if (!dir || !out) { console.error('usage: site <editions-dir> --out <dir>'); process.exit(2); }
  const eds = loadEditions(dir);
  if (!eds.length) { console.error('no editions'); process.exit(1); }
  const problems = buildSite(eds, out);
  if (problems.length) { console.error('editions have problems:\n- ' + problems.join('\n- ')); process.exit(1); }
  console.log(`built ${eds.length} edition(s), newest ${eds.at(-1)!.date} → ${out}`);
}
