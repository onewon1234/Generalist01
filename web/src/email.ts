/**
 * The daily email: logo and date, the main stories (headline, deck, a link to
 * the full article on the website), "오늘의 한 줄" with source links, and the
 * main sources. Table layout with inline styles, so Gmail (web and mobile
 * apps, which drop most <style> rules and web fonts) renders it as designed.
 * Links are absolute: <base>/<date>/articles/<slug>.html.
 */
import { esc, koreanDate, readingMinutes, safeUrl } from './render.ts';
import type { Edition } from './types.ts';

const INK = '#1d2420', MUTED = '#5b625d', ACCENT = '#2f45b5', PAPER = '#f5f6f2', RULE = '#d9dcd5', TINT = '#e8ebf6';
const SERIF = `'Noto Serif KR','Apple SD Gothic Neo','Malgun Gothic',serif`;
const SANS = `-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',Roboto,sans-serif`;

export function articleUrl(base: string, e: Edition, slug: string): string {
  return `${base.replace(/\/?$/, '/')}${e.date}/articles/${slug}.html`;
}
export function editionUrl(base: string, e: Edition): string { return `${base.replace(/\/?$/, '/')}${e.date}/`; }

function shortDate(iso: string): string {
  const t = new Date(Date.parse(iso) + 9 * 3_600_000);
  return `${t.getUTCMonth() + 1}월 ${t.getUTCDate()}일`;
}

export interface Mail { subject: string; html: string; text: string }

export function renderEmail(e: Edition, base: string, opts: { test?: boolean } = {}): Mail {
  const total = e.stories.reduce((n, s) => n + readingMinutes(s), 0);
  const subject = `${opts.test ? '[테스트] ' : ''}Generalist Daily ${koreanDate(e.date).replace(/^\d+년 /, '')} · ${e.stories[0]?.headline ?? ''}`;
  const a = (href: string, text: string, style = '') => { const u = safeUrl(href); return u ? `<a href="${esc(u)}" style="color:${ACCENT};text-decoration:none;${style}">${text}</a>` : text; };
  const stories = e.stories.map((s, i) => {
    const url = articleUrl(base, e, s.slug);
    const srcs = s.sources.slice(0, 3).map((x) => a(x.url, esc(x.publisher), 'color:' + MUTED + ';text-decoration:underline;')).join(' · ');
    return `<tr><td style="padding:${i ? '22px' : '6px'} 0 22px;border-bottom:1px solid ${RULE};">
  <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;color:${MUTED};">${esc(s.domain)}${s.place ? ` · ${esc(s.place)}` : ''} · ${readingMinutes(s)}분</p>
  <h2 style="margin:0 0 8px;font-family:${SERIF};font-size:${i ? '20px' : '25px'};line-height:1.4;font-weight:800;color:${INK};"><a href="${esc(url)}" style="color:${INK};text-decoration:none;">${esc(s.headline)}</a></h2>
  <p style="margin:0 0 10px;font-family:${SERIF};font-size:16px;line-height:1.7;color:${MUTED};">${esc(s.deck)}</p>
  <p style="margin:0;font-family:${SANS};font-size:14px;"><a href="${esc(url)}" style="color:${ACCENT};text-decoration:none;font-weight:600;">전문 읽기 →</a></p>
  ${srcs ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:12px;color:${MUTED};">출처: ${srcs}</p>` : ''}
</td></tr>`;
  }).join('\n');
  const lines = e.briefs.map((b) => `<tr><td style="padding:9px 0;border-top:1px solid ${RULE};font-family:${SANS};font-size:14px;line-height:1.55;color:${INK};">
  <span style="display:inline-block;min-width:30px;padding:1px 5px;margin-right:6px;border-radius:4px;background:${TINT};color:${ACCENT};font-size:11px;font-weight:700;text-align:center;">${esc(b.tag)}</span>${esc(b.line ?? b.label)}
  <span style="color:${MUTED};font-size:12px;white-space:nowrap;"> · ${a(b.url, esc(b.publisher), 'color:' + MUTED + ';text-decoration:underline;')} ${shortDate(b.published)}</span>
</td></tr>`).join('\n');
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(e.intro ?? e.stories[0]?.deck ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};"><tr><td align="center" style="padding:20px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 0 14px;border-bottom:2px solid ${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-family:${SERIF};font-size:24px;font-weight:900;color:${INK};"><a href="${esc(editionUrl(base, e))}" style="color:${INK};text-decoration:none;">Generalist Daily</a></td>
    <td align="right" style="font-family:${SANS};font-size:13px;color:${MUTED};">${koreanDate(e.date)}</td>
  </tr></table>
</td></tr>
${opts.test ? `<tr><td style="padding:10px 12px;margin-top:10px;background:#fdf3d3;font-family:${SANS};font-size:13px;color:${INK};">테스트 발송입니다. 실제 판이 아닙니다.</td></tr>` : ''}
${e.intro ? `<tr><td style="padding:16px 0 4px;font-family:${SERIF};font-size:16px;line-height:1.7;color:${MUTED};">${esc(e.intro)} <span style="white-space:nowrap;">(모두 읽는 데 약 ${total}분)</span></td></tr>` : ''}
${stories}
${e.briefs.length ? `<tr><td style="padding:24px 0 6px;"><h3 style="margin:0;font-family:${SERIF};font-size:18px;font-weight:900;color:${INK};">오늘의 한 줄</h3><p style="margin:2px 0 6px;font-family:${SANS};font-size:12px;color:${MUTED};">메인 글과 겹치지 않는 국내외 소식. ${a(editionUrl(base, e) + '#briefs', '자세히 보기')}</p></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table></td></tr>` : ''}
<tr><td style="padding:28px 0 8px;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid ${RULE};">
  모든 글은 원문을 확인한 출처에 근거하며, 기사마다 번호 붙은 출처를 달았습니다. ${a(editionUrl(base, e), '웹에서 보기')} · ${a(base.replace(/\/?$/, '/') + 'archive.html', '지난 판')}<br>
  ${e.provenance ? esc(e.provenance) + '<br>' : ''}이 메일은 Generalist Daily 발행인에게 보내는 메일입니다.
</td></tr>
</table></td></tr></table>
</body></html>
`;
  const text = [`Generalist Daily · ${koreanDate(e.date)}`, '', e.intro ?? '', '',
    ...e.stories.flatMap((s) => [s.headline, s.deck, articleUrl(base, e, s.slug), '']),
    '오늘의 한 줄', ...e.briefs.map((b) => `[${b.tag}] ${b.line ?? b.label} (${b.publisher}) ${b.url}`), '', `웹: ${editionUrl(base, e)}`].join('\n');
  return { subject, html, text };
}
