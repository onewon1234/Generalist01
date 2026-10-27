/**
 * Editorial preview (no AI, no database): pick a balanced pool of candidate
 * stories from ingestion, retrieve a few original articles per story with
 * recorded access status, extract evidence, cross-check, score heuristically
 * and select an edition with the existing selection rules.
 *
 * Heuristic scores stand in for the editor model until paid AI calls are
 * approved; they are labelled as such everywhere they appear.
 */
import { publisherKey, independentPublishers } from '../cluster.ts';
import type { Fetcher } from '../collect/http.ts';
import { broadOf } from '../config.ts';
import { sourceTime } from '../freshness.ts';
import type { IngestResult } from '../ingest/ingest.ts';
import { corroborate, type Corroboration } from '../research/corroborate.ts';
import { RobotsCache } from '../research/robots.ts';
import { politeFetcher, retrieveArticle, type RetrievalRecord } from '../research/retrieve.ts';
import { assignCardSizes, selectEdition, suitability, type Bucket } from '../select.ts';
import { hoursBetween } from '../text.ts';
import type { Article, Cluster, Scores } from '../types.ts';
import { chooseBriefs, type BriefCandidate } from './briefs.ts';
import { classify, SUBJECT_KO } from './classify.ts';

export interface PreviewStory {
  key: string;
  title: string;
  language: string;
  subject: string;
  sports: boolean;
  publishers: number;
  articles: number;
  newestAgeHours: number | null;
  records: RetrievalRecord[];
  corroboration: Corroboration;
  scores: Scores;
  suitability: number;
  reasoning: string[];
  selected: boolean;
  bucket?: Bucket | 'fill';
  cardSize?: string;
  rejectReason?: string;
}

export interface Preview {
  generatedAt: string;
  ingest: IngestResult['counts'] & { sourcesOk: number; sources: number };
  pool: number;
  fetches: number;
  stories: PreviewStory[];
  /** '짧게 보는 세상' candidates (sentences are written in the writer stage). */
  briefs: BriefCandidate[];
  briefsExcluded: { title: string; reason: string }[];
  warnings: string[];
}

export interface PreviewOptions {
  now?: Date;
  /** Candidates researched (balanced across languages and subjects). */
  poolSize?: number;
  /** Articles retrieved per candidate (distinct publishers). */
  perStory?: number;
  minGapMs?: number;
}

/** Candidate pool for research: strongest clusters first, capped per language and per subject. */
export function choosePool(res: IngestResult, poolSize: number, sourceSubject: (a: Article) => string): Cluster[] {
  const byKey = new Map(res.clusters.map((c) => [c.key, c]));
  const perLang = new Map<string, number>(), perSubject = new Map<string, number>();
  const langCap = Math.ceil(poolSize * 0.6), subjectCap = Math.ceil(poolSize * 0.35);
  const out: Cluster[] = [];
  for (const cand of res.candidates) {
    if (out.length >= poolSize) break;
    const c = byKey.get(cand.key);
    if (!c) continue;
    const tier1 = c.articles.some((a) => a.reliabilityTier === 1);
    // Single-source stories are researched when the source is tier 1 or a slow,
    // non-news publisher (standalone features and essays are worth investigating).
    if (cand.publishers < 2 && !tier1 && c.freshnessType !== 'evergreen') continue;
    const cls = classify(c.articles.map((a) => a.title), sourceSubject(c.articles[0]));
    if (cls.sports) continue;
    const broad = broadOf(cls.subject);
    if ((perLang.get(cand.language) ?? 0) >= langCap || (perSubject.get(broad) ?? 0) >= subjectCap) continue;
    perLang.set(cand.language, (perLang.get(cand.language) ?? 0) + 1);
    perSubject.set(broad, (perSubject.get(broad) ?? 0) + 1);
    out.push(c);
  }
  return out;
}

/** Up to `n` articles from distinct publishers: most reliable, then newest. */
export function pickArticles(c: Cluster, n: number): Article[] {
  const seen = new Set<string>();
  return [...c.articles]
    .sort((a, b) => (a.reliabilityTier ?? 2) - (b.reliabilityTier ?? 2) || (sourceTime(b) ?? '').localeCompare(sourceTime(a) ?? ''))
    .filter((a) => {
      const k = publisherKey(a.publisher);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

const clamp = (x: number) => Math.max(0, Math.min(10, Math.round(x * 10) / 10));

/** Heuristic stand-in for the editor model's scores. Transparent and deterministic. */
export function heuristicScores(c: Cluster, subject: string, sports: boolean, cor: Corroboration, ageH: number | null): Scores {
  const pubs = independentPublishers(c);
  const read = cor.readPublishers.length;
  const evidence = cor.corroboratedFigures.length;
  const discovery = broadOf(subject) === 'science-technology-ai' || broadOf(subject) === 'history-civilization-geography';
  const significance = clamp(4 + Math.min(4, Math.log2(pubs) * 1.4) + (c.articles.some((a) => a.reliabilityTier === 1) ? 0.5 : 0) + (evidence ? 0.5 : 0) - (sports ? 3 : 0));
  const timeliness = clamp(ageH == null ? 3 : ageH <= 6 ? 9 : ageH <= 12 ? 8 : ageH <= 24 ? 7 : ageH <= 48 ? 5 : 3);
  const insight = clamp(4 + Math.min(2, read) + Math.min(2, evidence) * 0.5);
  const title = c.title;
  return {
    significance, timeliness, interest: clamp(6 + (discovery ? 1 : 0)), insight, novelty: clamp(5 + (discovery ? 2 : 0)), accessibility: 7,
    reliable: read >= 1,
    isMajor: pubs >= 8,
    ongoing: pubs >= 8,
    elementary: false,
    contemporaryHook: true,
    aiPrimary: /\bAI\b|인공지능|artificial intelligence|chatbot|챗봇|LLM/i.test(title),
    whyNow: ageH == null ? '' : `최근 ${Math.round(ageH)}시간 안에 ${pubs}개 매체가 보도`,
    angle: '',
    category: subject,
    subtopic: null,
    functions: discovery ? ['something_new', 'in_the_know'] : pubs >= 5 ? ['must_know'] : ['in_the_know'],
    rationale: 'heuristic (no AI)',
  };
}

const STATUS_KO: Record<string, string> = {
  read: '원문 확인', partial: '본문 부족', paywalled: '유료', restricted: '이용 제한 표시', 'blocked-robots': 'robots 차단',
  'robots-unreachable': 'robots 확인 불가', 'http-error': 'HTTP 오류', 'network-error': '접속 실패', 'not-html': '문서 형식 아님',
};

export function reasoningFor(s: Omit<PreviewStory, 'reasoning'>): string[] {
  const tried = s.records.length, read = s.corroboration.readPublishers.length;
  const unread = s.corroboration.unread.map((u) => STATUS_KO[u.status] ?? u.status);
  const lines = [
    `보도 규모: ${s.publishers}개 매체, 기사 ${s.articles}건${s.newestAgeHours != null ? ` · 최신 보도 ${Math.round(s.newestAgeHours)}시간 전` : ''}`,
    `원문 확인: ${read}개 매체 / 시도 ${tried}건${unread.length ? ` (못 읽음: ${unread.join(', ')})` : ''}`,
    `검증 수준: ${s.corroboration.level === 'corroborated' ? '2개 이상 매체 원문에서 확인' : s.corroboration.level === 'single-source' ? '1개 매체 원문만 확인 (단일 출처)' : '원문 미확인'}`,
  ];
  if (s.corroboration.corroboratedFigures.length) lines.push(`교차 확인된 수치: ${s.corroboration.corroboratedFigures.slice(0, 4).map((f) => `${f.figure}(${f.publishers.join('·')})`).join(', ')}`);
  lines.push(`분야: ${SUBJECT_KO[broadOf(s.subject)] ?? s.subject} (키워드 분류)`);
  lines.push(`휴리스틱 적합도 ${s.suitability} (중요도 ${s.scores.significance}, 시의성 ${s.scores.timeliness}, 근거 ${s.scores.insight}) — AI 편집 판단 아님`);
  return lines;
}

export async function buildPreview(res: IngestResult, fetcher: Fetcher, sourceSubject: (a: Article) => string, opts: PreviewOptions = {}): Promise<Preview> {
  const now = opts.now ?? new Date();
  const polite = politeFetcher(fetcher, opts.minGapMs ?? 1500);
  const robots = new RobotsCache(polite);
  const pool = choosePool(res, opts.poolSize ?? 24, sourceSubject);
  let fetches = 0;
  const stories: PreviewStory[] = [];
  const clusters: Cluster[] = [];
  await Promise.all(pool.map(async (c) => {
    const picks = pickArticles(c, opts.perStory ?? 3);
    const records: RetrievalRecord[] = [];
    for (const a of picks) { records.push(await retrieveArticle(a, { fetcher: polite, robots, now: () => new Date() })); fetches++; }
    const cor = corroborate(records);
    const texts = [...c.articles.map((a) => a.title), ...records.flatMap((r) => r.evidence.map((e) => e.text))];
    const cls = classify(texts, sourceSubject(c.articles[0]));
    const newest = c.articles.map(sourceTime).filter((t): t is string => !!t).sort().at(-1);
    const ageH = newest ? Math.round(hoursBetween(newest, now) * 10) / 10 : null;
    const scores = heuristicScores(c, cls.subject, cls.sports, cor, ageH);
    c.scores = scores;
    clusters.push(c);
    const s: Omit<PreviewStory, 'reasoning'> = {
      key: c.key, title: c.title, language: c.articles[0]?.language ?? '', subject: cls.subject, sports: cls.sports,
      publishers: independentPublishers(c), articles: c.articles.length, newestAgeHours: ageH, records, corroboration: cor,
      scores, suitability: suitability(scores), selected: false,
    };
    stories.push({ ...s, reasoning: [] });
  }));
  const sel = selectEdition(clusters, now, [], { subject7d: new Map(), subject30d: new Map(), subtopic7d: new Map() });
  const sizes = assignCardSizes(sel.chosen);
  for (const st of stories) {
    const chosen = sel.chosen.find((c) => c.key === st.key);
    const c = clusters.find((x) => x.key === st.key)!;
    st.selected = !!chosen;
    st.bucket = chosen?.bucket;
    st.cardSize = sizes.get(st.key)?.size;
    st.rejectReason = chosen ? undefined : c.rejectReason ?? 'not selected (lower adjusted score)';
    st.reasoning = reasoningFor(st);
  }
  stories.sort((a, b) => Number(b.selected) - Number(a.selected) || b.suitability - a.suitability);
  const { briefs, excluded } = chooseBriefs(stories);
  return {
    generatedAt: now.toISOString(),
    ingest: { ...res.counts, sourcesOk: res.health.filter((h) => h.ok).length, sources: res.health.length },
    pool: pool.length,
    fetches,
    stories,
    briefs,
    briefsExcluded: excluded,
    warnings: sel.warnings,
  };
}
