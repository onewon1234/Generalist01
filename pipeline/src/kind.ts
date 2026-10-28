/**
 * Content kind: is this item a story we could write about, or a format that
 * should never be a main story (a review, opinion column, sponsored content,
 * live blog, video page, digest or the publisher's own announcement)?
 *
 * This is a gate, not a score: such items reached the r9 preview's chosen six
 * (a film review, a sponsored MIT Technology Review Insights piece) because
 * heuristic scores cannot tell formats apart. Reviews and opinion can still
 * point to a story; the story itself has to come from reporting or research.
 */
export type ContentKind = 'story' | 'review' | 'opinion' | 'sponsored' | 'live' | 'video' | 'digest' | 'house';

export const KIND_KO: Record<ContentKind, string> = {
  story: '기사', review: '리뷰·비평', opinion: '의견·칼럼', sponsored: '광고·후원 콘텐츠', live: '실시간 업데이트',
  video: '영상 페이지', digest: '모음·뉴스레터', house: '매체 자체 공지·행사',
};

export interface KindInput { title: string; url?: string; author?: string | null; publisher?: string }

const RULES: [Exclude<ContentKind, 'story'>, (x: { t: string; u: string; a: string; p: string }) => boolean][] = [
  ['sponsored', ({ t, u, a }) => /\bsponsored\b|in partnership with|brought to you by|paid (post|content)|partner content|advertorial|\[광고\]|\[협찬\]/i.test(t)
    || /\/(sponsored|partner-content|paid-content|brand-studio|advertorial)\//i.test(u)
    || /\binsights$|\bbrand ?studio\b|\bcontent studio\b|\bsponsored\b|\bpartner\b|\bpaid post\b/i.test(a)],
  ['live', ({ t, u }) => /\/live\//i.test(u) || /\blive\s*[:–—-]|\blive updates?\b|\blive blog\b|\bas it happened\b|라이브|실시간 중계/i.test(t)],
  ['video', ({ u }) => /\/(videos?|watch|video\/newsfeed)\//i.test(u)],
  ['review', ({ t }) => /\breview\s*[–—-]|\breview[:：]|\breview$|\breviewed\b|리뷰|서평|\[신간\]/i.test(t)],
  ['opinion', ({ t, u }) => /\bopinion\b|\bop-ed\b|사설|칼럼|기고|시론|\[논단\]|\[기자수첩\]/i.test(t) || /\/(opinion|commentisfree|editorials?)\//i.test(u)],
  ['digest', ({ t }) => /\b(daily|weekly)[:：]|\bthis week in\b|\bweek in review\b|\bround-?up\b|\bnewsletter\b|\bthe download\b|\bmorning briefing\b|간추린|모닝 ?브리핑|오늘의 주요 뉴스|헤드라인 모음/i.test(t)],
  ['house', ({ t, p }) => /\bwe (have )?launched\b|\bour new (website|app|look)\b|\bsubscribe\b|\bjoin us\b|구독하세요|창간 \d+주년/i.test(t)
    || (!!p && new RegExp(`^${escape(p.split(/[\s–-]/)[0])} (awards?|debate|day|prize)\\b`, 'i').test(t))],
];

function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function contentKind(x: KindInput): ContentKind {
  const v = { t: x.title.trim(), u: x.url ?? '', a: (x.author ?? '').trim(), p: x.publisher ?? '' };
  for (const [kind, test] of RULES) if (test(v)) return kind;
  return 'story';
}
