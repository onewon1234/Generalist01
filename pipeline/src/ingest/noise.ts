/**
 * Cheap deterministic filter for items that are never edition material:
 * personnel notices, obituaries, photo/video-only posts, schedules, ads.
 * Conservative on purpose: anything uncertain passes to the editor stage.
 */
import type { Article } from '../types.ts';

const KO_PREFIX = /^\s*[[(【〈<]\s*(인사|부고|부음|동정|포토|사진|영상|화보|오늘의 ?운세|운세|날씨|게시판|알림|모집|공고|광고|AD|PR|보도자료|신상품|프로필|라이프 ?캘린더)\s*[\]）)】〉>]/i;
const KO_ANY = /(별세|모친상|부친상|빙모상|빙부상|장인상|장모상|결혼식 안내|오늘의 ?운세)/;
const EN = /^\s*(in pictures|photos?:|watch:|video:|quiz:|crossword|horoscope|sponsored|advertisement)\b/i;
const LIVE = /\b(live|as it happened)\b.*$/i;
/** Newsletter digests and roundups: several unrelated items under one headline. */
const DIGEST = /^\s*(the download\s*:|business daily\s*$|morning (briefing|brief)\b|evening (briefing|brief)\b|first edition\b|week in review\b|[^:]{0,30}\bweekly\s*:)|^\s*\[[^\]]*(오늘뉴스|주요뉴스|뉴스 ?브리핑|오늘의 뉴스)[^\]]*\]/i;

export type NoiseReason = 'notice' | 'obituary' | 'media-only' | 'promo' | 'digest';

export function noiseReason(a: Pick<Article, 'title'>): NoiseReason | null {
  const t = a.title;
  if (DIGEST.test(t)) return 'digest';
  const m = t.match(KO_PREFIX);
  if (m) {
    const k = m[1].replace(/\s/g, '');
    if (['부고', '부음'].includes(k)) return 'obituary';
    if (['포토', '사진', '영상', '화보'].includes(k)) return 'media-only';
    if (['광고', 'AD', 'PR', '보도자료', '신상품'].includes(k.toUpperCase()) || ['광고', '보도자료', '신상품'].includes(k)) return 'promo';
    return 'notice';
  }
  if (KO_ANY.test(t)) return /운세|결혼식/.test(t) ? 'notice' : 'obituary';
  if (EN.test(t)) return /sponsored|advertisement/i.test(t) ? 'promo' : 'media-only';
  return null;
}

/** Live blogs are kept (they carry real developments) but flagged for the editor. */
export function isLiveBlog(a: Pick<Article, 'title' | 'url'>): boolean {
  return LIVE.test(a.title) || /\/live\//.test(a.url);
}
