/**
 * Static HTML for the homepage and article pages. Pure functions: data in,
 * HTML out. Everything from the edition is escaped; only http(s) links are
 * emitted; citation markers become footnote links.
 */
import type { Brief, Edition, Section, Source, Story } from './types.ts';
import { checkBriefs, checkHeadlines } from './checks.ts';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Only absolute http(s) URLs are linked. */
export function safeUrl(u: string): string | null {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null;
  } catch { return null; }
}

/**
 * Escape, then render **bold** and citation markers [n] as footnote links.
 * Within a paragraph, a citation repeated by the next marker is shown only
 * once (at the later position), so notes do not interrupt every sentence.
 */
export function inline(text: string, sources: Source[] = []): string {
  const known = new Set(sources.map((s) => s.n));
  let h = esc(text);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const groups = [...h.matchAll(/(?:\[\d+\])+/g)].map((m) => m[0]);
  let i = 0;
  h = h.replace(/(?:\[\d+\])+/g, (group) => {
    const ns = [...group.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    if (!ns.every((n) => known.has(n))) throw new Error(`citation ${group} has no matching source`);
    const next = groups[++i];
    if (next === group) return '';
    return `<sup class="cite">${ns.map((n) => `<a href="#note-${n}" aria-label="출처 ${n}">${n}</a>`).join('')}</sup>`;
  });
  return h;
}

/** Korean reading speed (characters per minute) for the reading-time estimate. */
const CHARS_PER_MINUTE = 500;
export function readingMinutes(s: Story): number {
  const chars = [s.standfirst, ...s.sections.flatMap((x) => [x.heading ?? '', ...x.paragraphs]),
    ...(s.explainer?.items.map((i) => i.term + i.text) ?? []), ...(s.timeline?.events.map((e) => e.when + e.what) ?? [])]
    .join('').replace(/\[\d+\]|\*\*/g, '').replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / CHARS_PER_MINUTE));
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
export function koreanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 ${day}요일`;
}

function kst(iso?: string): string {
  if (!iso) return '';
  const t = new Date(Date.parse(iso) + 9 * 3_600_000);
  return `${t.getUTCFullYear()}년 ${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`;
}

const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@400;600;700;900&display=swap';

function page(title: string, body: string, opts: { description: string; preview: boolean; provenance?: string; depth: number }): string {
  const root = opts.depth ? '../'.repeat(opts.depth) : './';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(opts.description)}">
${opts.preview ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
${opts.preview ? `<div class="preview-banner" role="note">비공개 미리보기입니다. 발행본이 아닙니다.${opts.provenance ? ` ${esc(opts.provenance)}` : ''}</div>` : ''}
${body}
</body>
</html>
`;
}

function masthead(e: Edition, depth: number): string {
  const root = depth ? '../'.repeat(depth) : './';
  return `<header class="masthead">
  <a class="wordmark" href="${root}index.html">Generalist Daily</a>
  <p class="edition-date"><time datetime="${esc(e.date)}">${koreanDate(e.date)}</time></p>
</header>`;
}

function storyMeta(s: Story): string {
  const parts = [`<span>${esc(s.domain)}</span>`];
  if (s.place) parts.push(`<span>${esc(s.place)}</span>`);
  parts.push(`<span>${readingMinutes(s)}분</span>`);
  return `<p class="meta">${parts.join('')}</p>`;
}

function shortDate(iso: string): string {
  const t = new Date(Date.parse(iso) + 9 * 3_600_000);
  return `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`;
}

export function renderHome(e: Edition): string {
  const [lead, ...rest] = e.stories;
  const item = (s: Story) => `<li class="entry">
    <a href="articles/${esc(s.slug)}.html">
      <h2 class="entry-headline">${esc(s.headline)}</h2>
      <p class="entry-deck">${esc(s.deck)}</p>
    </a>
    ${storyMeta(s)}
  </li>`;
  const body = `${masthead(e, 0)}
<main class="home">
  ${e.intro ? `<p class="intro">${esc(e.intro)}</p>` : ''}
  ${e.briefs.length ? `<p class="jump"><a href="#briefs">짧게 보는 세상 ${e.briefs.length}건 바로 보기</a></p>` : ''}
  ${lead ? `<article class="lead">
    <a href="articles/${esc(lead.slug)}.html">
      <h1 class="lead-headline">${esc(lead.headline)}</h1>
      <p class="lead-deck">${esc(lead.deck)}</p>
    </a>
    ${storyMeta(lead)}
  </article>` : '<p class="empty">오늘 판에 실린 글이 없습니다.</p>'}
  ${rest.length ? `<ol class="entries" aria-label="오늘의 다른 글">${rest.map(item).join('\n')}</ol>` : ''}
</main>
${e.briefs.length ? renderBriefs(e.briefs) : ''}
${footer()}`;
  return page(`Generalist Daily — ${koreanDate(e.date)}`, body, { description: e.intro ?? lead?.deck ?? '', preview: e.status !== 'published', provenance: e.provenance, depth: 0 });
}

/** "짧게 보는 세상": a separate band after the main stories, scannable on a phone. */
export function renderBriefs(bs: Brief[]): string {
  return `<section class="briefs" id="briefs" aria-labelledby="briefs-title">
  <div class="briefs-inner">
    <header class="briefs-header">
      <h2 id="briefs-title">짧게 보는 세상</h2>
      <p>메인에 싣지 않은 국내외 소식 ${bs.length}건</p>
    </header>
    <ul class="brief-list">
      ${bs.map((b) => {
        const u = safeUrl(b.url);
        return `<li class="brief">
        <span class="brief-tag">${esc(b.tag)}</span>
        <div class="brief-body">
          <p><strong class="brief-label">${esc(b.label)}</strong> ${esc(b.text)}</p>
          <p class="brief-meta">${u ? `<a href="${esc(u)}" rel="noopener">${esc(b.publisher)}</a>` : esc(b.publisher)}<time datetime="${esc(b.published)}">${shortDate(b.published)}</time></p>
        </div>
      </li>`;
      }).join('\n')}
    </ul>
  </div>
</section>`;
}

function renderSection(sec: Section, sources: Source[]): string {
  return `<section>
    ${sec.heading ? `<h2>${esc(sec.heading)}</h2>` : ''}
    ${sec.paragraphs.map((p) => `<p>${inline(p, sources)}</p>`).join('\n')}
  </section>`;
}

function renderExplainer(s: Story): string {
  if (!s.explainer) return '';
  return `<aside class="explainer" aria-label="${esc(s.explainer.title)}">
    <h2>${esc(s.explainer.title)}</h2>
    <dl>${s.explainer.items.map((i) => `<dt>${esc(i.term)}</dt><dd>${inline(i.text, s.sources)}</dd>`).join('')}</dl>
  </aside>`;
}

function renderTimeline(s: Story): string {
  if (!s.timeline) return '';
  return `<aside class="timeline" aria-label="${esc(s.timeline.title)}">
    <h2>${esc(s.timeline.title)}</h2>
    <ol>${s.timeline.events.map((ev) => `<li><span class="when">${esc(ev.when)}</span><span class="what">${inline(ev.what, s.sources)}</span></li>`).join('')}</ol>
  </aside>`;
}

function renderSources(sources: Source[]): string {
  return `<section class="notes" aria-labelledby="notes-title">
    <h2 id="notes-title">출처</h2>
    <ol>
      ${[...sources].sort((a, b) => a.n - b.n).map((s) => {
        const u = safeUrl(s.url);
        const by = [s.publisher, s.author].filter(Boolean).map((x) => esc(x!)).join(', ');
        const title = u ? `<a href="${esc(u)}" rel="noopener">${esc(s.title)}</a>` : esc(s.title);
        return `<li id="note-${s.n}" value="${s.n}"><span class="note-by">${by}</span> ${title}<span class="note-detail">${s.published ? `${kst(s.published)} 게시. ` : ''}${esc(s.access)}.${s.note ? ` ${esc(s.note)}` : ''}</span></li>`;
      }).join('\n')}
    </ol>
  </section>`;
}

/** Explainer and timeline go after the first section, where context is needed. */
export function renderArticle(e: Edition, s: Story): string {
  const [first, ...more] = s.sections;
  const body = `${masthead(e, 1)}
<main class="article">
  <article>
    <header class="article-header">
      ${storyMeta(s)}
      <h1>${esc(s.headline)}</h1>
      <p class="standfirst">${esc(s.standfirst)}</p>
    </header>
    <div class="article-body">
      ${first ? renderSection(first, s.sources) : ''}
      ${renderTimeline(s)}
      ${renderExplainer(s)}
      ${more.map((x) => renderSection(x, s.sources)).join('\n')}
    </div>
    ${renderSources(s.sources)}
  </article>
  <nav class="next" aria-label="다른 글">
    <a href="../index.html">오늘의 판으로 돌아가기</a>
    ${e.briefs.length ? `<a href="../index.html#briefs">짧게 보는 세상 ${e.briefs.length}건</a>` : ''}
  </nav>
</main>
${footer()}`;
  return page(`${s.headline} — Generalist Daily`, body, { description: s.standfirst, preview: e.status !== 'published', provenance: e.provenance, depth: 1 });
}

function footer(): string {
  return `<footer class="site-footer"><p>Generalist Daily는 매일 한 번, 세계를 조금 더 깊이 이해하게 하는 글을 고릅니다. 모든 글은 원문을 직접 확인한 출처에 근거합니다.</p></footer>`;
}

/** Validation before building: slugs, citations, links. Returns problems (empty when fine). */
export function validateEdition(e: Edition): string[] {
  const out: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) out.push(`bad date ${e.date}`);
  const slugs = new Set<string>();
  for (const s of e.stories) {
    if (!/^[a-z0-9-]+$/.test(s.slug)) out.push(`bad slug ${s.slug}`);
    if (slugs.has(s.slug)) out.push(`duplicate slug ${s.slug}`);
    slugs.add(s.slug);
    const ns = new Set(s.sources.map((x) => x.n));
    for (const src of s.sources) if (!safeUrl(src.url)) out.push(`${s.slug}: source ${src.n} has no http(s) URL`);
    const text = [...s.sections.flatMap((x) => x.paragraphs), ...(s.explainer?.items.map((i) => i.text) ?? []), ...(s.timeline?.events.map((x) => x.what) ?? [])].join(' ');
    const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    for (const n of cited) if (!ns.has(n)) out.push(`${s.slug}: citation [${n}] has no source`);
    for (const n of ns) if (!cited.has(n)) out.push(`${s.slug}: source ${n} is never cited`);
  }
  for (const b of e.briefs) if (!safeUrl(b.url)) out.push(`brief without http(s) link: ${b.text.slice(0, 30)}`);
  out.push(...checkHeadlines(e).errors, ...checkBriefs(e).errors);
  return out;
}
