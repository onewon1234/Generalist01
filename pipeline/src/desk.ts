/**
 * Editorial desks: the user's default edition composition (CLAUDE.md §2).
 * A typical edition of 5–7 main stories has about one Korea story, one or two
 * world/international stories, one economy story, one AI/technology story and
 * zero to two free-exploration pieces (science, culture, history, philosophy,
 * psychology, language, art). This is a preference, not a quota: selection
 * nudges toward it only with candidates that clear the quality bar, never
 * pads with weak stories, and lets exceptional stories exceed it.
 */
import { broadOf } from './config.ts';

export type Desk = 'korea' | 'world' | 'economy' | 'tech' | 'explore';

export const DESK_KO: Record<Desk, string> = { korea: '한국', world: '세계', economy: '경제', tech: 'AI·기술', explore: '탐구' };

/** Preferred range per edition (tendency). */
export const DESK_PREFERENCE: Record<Desk, { min: number; max: number }> = {
  korea: { min: 1, max: 1 },
  world: { min: 1, max: 2 },
  economy: { min: 1, max: 1 },
  tech: { min: 1, max: 1 },
  explore: { min: 0, max: 2 },
};

/** Soft weights (suitability points). */
export const DESK_WEIGHTS = {
  /** Bonus for a story that fills a desk still below its preferred minimum. */
  belowMinBonus: 5,
  /** The bonus applies only to candidates at least this far above EDITION.minSuitability. */
  qualityMargin: 5,
  /** Penalty per story already at or above the desk's preferred maximum. */
  atMaxPenalty: 5,
  /** Research places reserved per desk with a preferred minimum, when such candidates exist. */
  poolReserve: 3,
} as const;

/** Names of other countries, leaders and institutions in Korean headlines. */
const FOREIGN = /미국|美|중국|中|일본|日|러시아|露|우크라|유럽|EU|유로존|영국|英|프랑스|佛|독일|獨|이스라엘|이란|가자|하마스|시리아|요르단|레바논|사우디|튀르키예|인도|파키스탄|베트남|대만|북한|브라질|아르헨|멕시코|캐나다|호주|아프리카|콩고|수단|나토|NATO|유엔|UN|트럼프|시진핑|푸틴|네타냐후|룰라|벨기에|폴란드|스페인|이탈리아|그리스|필리핀|태국|인니|인도네시아|말레이|싱가포르|몽골|현지시간|외신|뉴욕증시|월가/;

/**
 * Event location of a Korean-language story, estimated from its title (and
 * evidence): 'foreign' when it names another country, foreign leader or
 * institution. Geography of the event, not of the reporting outlet.
 */
export function koreanScope(title: string, evidence = ''): 'foreign' | 'domestic' {
  return FOREIGN.test(title) || /\(현지시간\)/.test(evidence) ? 'foreign' : 'domestic';
}

/** English or Korean stories about Korea itself. */
const ABOUT_KOREA = /\bSouth Korea|\bSeoul\b|\bKorean (?:government|president|economy|court|won)|한국 정부|국내|서울시|대법원|국회|금융위|기재부|한은|한국은행/;

const TECH = /\bAI\b|A\.I\.|인공지능|생성형|챗봇|chatbot|LLM|language model|tokeni[sz]|토큰|반도체|semiconductor|\bchips?\b|software|소프트웨어|알고리즘|algorithm|robot|로봇|데이터센터|data cent(?:er|re)|플랫폼|platform|스타트업|startup|암호화폐|crypto|스마트폰|smartphone|전기차|\bEVs?\b|배터리|battery|quantum comput|양자컴퓨|satellite internet|자율주행|self-driving|cyber|사이버|해킹|hack/i;

export interface DeskInput { title: string; language: string; category: string; aiPrimary?: boolean; evidence?: string }

/** Desk of a candidate. The editor may override it (`Scores.desk`). */
export function deskOf(s: DeskInput): Desk {
  const broad = broadOf(s.category);
  const korean = s.language === 'ko';
  if ((korean && koreanScope(s.title, s.evidence) === 'domestic') || ABOUT_KOREA.test(s.title)) return 'korea';
  if (s.aiPrimary || (TECH.test(s.title) && (broad === 'science-technology-ai' || broad === 'economics-finance-business'))) return 'tech';
  if (broad === 'economics-finance-business') return 'economy';
  if (broad === 'world-politics-society') return 'world';
  return 'explore';
}

/** Soft adjustment for adding a story of `desk` to an edition that already holds `counts`. */
export function deskAdjustment(desk: Desk, counts: Partial<Record<Desk, number>>, suitability: number, minSuitability: number): number {
  const pref = DESK_PREFERENCE[desk];
  const have = counts[desk] ?? 0;
  if (have < pref.min && suitability >= minSuitability + DESK_WEIGHTS.qualityMargin) return DESK_WEIGHTS.belowMinBonus;
  if (have >= pref.max) return -DESK_WEIGHTS.atMaxPenalty * (have - pref.max + 1);
  return 0;
}
