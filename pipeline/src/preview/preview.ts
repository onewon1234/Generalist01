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
import { assignCardSizes, clusterDesk, selectEdition, suitability } from '../select.ts';
import { hoursBetween } from '../text.ts';
import type { Article, Cluster, FreshnessType, Scores } from '../types.ts';
import { chooseBriefs, type BriefCandidate } from './briefs.ts';
import { deskOf, DESK_PREFERENCE, DESK_WEIGHTS, type Desk } from '../desk.ts';
import { classify, SUBJECT_KO } from './classify.ts';
import { crossLanguageDuplicates } from './crosslang.ts';
import { contentKind, isRoutineNotice, KIND_KO, type ContentKind } from '../kind.ts';

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
  /** Current story or evergreen piece. */
  form?: FreshnessType;
  /** Editorial desk of the default composition. */
  desk?: Desk;
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
  /** Items kept out of the main candidates by format (review, sponsored, live blog, …), with the reason. */
  formExcluded: { title: string; url: string; kind: ContentKind; stage: 'pool' | 'after reading' }[];
  /** Discovery leads from reference-only sources (not researched, not evidence). */
  leads: { title: string; url: string; source: string; publishedAt: string | null }[];
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

const AI_TITLE = /\bAI\b|인공지능|artificial intelligence|chatbot|챗봇|LLM/i;

/**
 * Candidate pool for research: strongest clusters first (ranking already takes
 * turns between sources), capped per broad subject so research covers several
 * domains. Each desk of the default composition with a preferred minimum
 * (Korea, world, economy, AI/tech) first gets up to DESK_WEIGHTS.poolReserve
 * places from its best-ranked candidates, so the editor can actually consider
 * them; the rest is filled by rank. There is no per-language share (a language
 * cap made Korean wire items fill every place English stories could not take,
 * audit 2026-10-27 r5).
 */
export function choosePool(res: IngestResult, poolSize: number, sourceSubject: (a: Article) => string, excluded: Preview['formExcluded'] = []): Cluster[] {
  const byKey = new Map(res.clusters.map((c) => [c.key, c]));
  const subjectCap = Math.ceil(poolSize * 0.35);
  // The same breadth rule per desk: research covers the whole edition, not one desk.
  const deskCap = Math.ceil(poolSize * 0.35);
  const perDesk = new Map<Desk, number>();
  const eligible: { c: Cluster; broad: string; desk: Desk }[] = [];
  for (const cand of res.candidates) {
    const c = byKey.get(cand.key);
    if (!c) continue;
    const tier1 = c.articles.some((a) => a.reliabilityTier === 1);
    // Single-source stories are researched when the source is tier 1 or a slow,
    // non-news publisher (standalone features and essays are worth investigating).
    if (cand.publishers < 2 && !tier1 && c.freshnessType !== 'evergreen') continue;
    // Format gate: a cluster is a candidate only through an article that is a story.
    const kinds = c.articles.map((a) => contentKind({ title: a.title, url: a.url, publisher: a.publisher }));
    const storyIdx = kinds.indexOf('story');
    if (storyIdx < 0) { excluded.push({ title: c.title, url: c.articles[0]?.url ?? '', kind: kinds[0], stage: 'pool' }); continue; }
    if (kinds[0] !== 'story' || contentKind({ title: c.title }) !== 'story') c.title = c.articles[storyIdx].title;
    const cls = classify(c.articles.map((a) => a.title), sourceSubject(c.articles[0]), { beat: c.freshnessType === 'evergreen' });
    if (cls.sports) continue;
    const desk = deskOf({ title: c.title, language: c.articles[0]?.language ?? '', category: cls.subject, aiPrimary: AI_TITLE.test(c.title) });
    eligible.push({ c, broad: broadOf(cls.subject), desk });
  }
  const perSubject = new Map<string, number>();
  const out = new Set<Cluster>();
  const take = (x: (typeof eligible)[number]) => {
    if (out.size >= poolSize || out.has(x.c) || (perSubject.get(x.broad) ?? 0) >= subjectCap || (perDesk.get(x.desk) ?? 0) >= deskCap) return false;
    perSubject.set(x.broad, (perSubject.get(x.broad) ?? 0) + 1);
    perDesk.set(x.desk, (perDesk.get(x.desk) ?? 0) + 1);
    out.add(x.c);
    return true;
  };
  for (const d of Object.keys(DESK_PREFERENCE) as Desk[]) {
    if (DESK_PREFERENCE[d].min < 1) continue;
    let n = 0;
    for (const x of eligible) if (x.desk === d && n < DESK_WEIGHTS.poolReserve && take(x)) n++;
  }
  for (const x of eligible) take(x);
  // Keep ranking order in the pool.
  return eligible.map((x) => x.c).filter((c) => out.has(c));
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

/**
 * Heuristic stand-in for the editor's reader-payoff scores. Transparent and
 * deterministic, and weak by design: curiosity, narrative and payoff need
 * editorial judgement, so they stay near neutral here.
 */
/**
 * Depth of what was actually read: the longest permitted text and its figures.
 * A 800-character wire item and a 9,000-character feature are not the same
 * material for an explanatory piece; this is evidence about the material, not a
 * desk bonus.
 */
export interface Depth { maxChars: number; figures: number }
export function depthOf(records: RetrievalRecord[]): Depth {
  const read = records.filter((r) => r.status === 'read');
  return { maxChars: Math.max(0, ...read.map((r) => r.textChars ?? 0)), figures: new Set(read.flatMap((r) => r.evidence.flatMap((e) => e.figures))).size };
}
/** Narrative material: −1 below 1,500 characters, 0 to 4,000, then up to +2 at 10,000+. */
export function depthNarrative(d: Depth): number {
  if (d.maxChars < 1500) return -1;
  if (d.maxChars < 4000) return 0;
  return Math.min(2, (d.maxChars - 4000) / 3000);
}

/**
 * Coverage breadth for relevance: distinct publishers, counting at most
 * BREADTH_PER_LANGUAGE per language. A domestic story covered by every Korean
 * outlet is one country's news cycle, not wider significance; without this the
 * Korean outlets activated on 2026-10-28 filled the r10 pool (22 of 40) with
 * routine domestic items on publisher count alone.
 */
export const BREADTH_PER_LANGUAGE = 3;
export function coverageBreadth(c: Cluster): number {
  const byLang = new Map<string, Set<string>>();
  for (const a of c.articles) {
    const l = a.language || '?';
    if (!byLang.has(l)) byLang.set(l, new Set());
    byLang.get(l)!.add(publisherKey(a.publisher));
  }
  return [...byLang.values()].reduce((n, s) => n + Math.min(BREADTH_PER_LANGUAGE, s.size), 0);
}

export function heuristicScores(c: Cluster, subject: string, sports: boolean, cor: Corroboration, ageH: number | null, depth: Depth = { maxChars: 4000, figures: 0 }): Scores {
  const pubs = independentPublishers(c);
  const breadth = coverageBreadth(c);
  const read = cor.readPublishers.length;
  const figures = cor.corroboratedFigures.length;
  const knowledge = c.freshnessType === 'evergreen' || ['science-technology-ai', 'history-civilization-geography', 'psychology-behavior-everyday', 'philosophy-literature-arts-culture'].includes(broadOf(subject));
  const current = ageH != null && ageH <= 48 ? 1 : 0;
  const relevance = clamp(4 + Math.min(3, Math.log2(breadth) * 1.2) + current + (c.articles.some((a) => a.reliabilityTier === 1) ? 0.5 : 0) - (sports ? 3 : 0));
  const title = c.title;
  return {
    curiosity: clamp(5 + (knowledge ? 1.5 : 0)),
    understanding: clamp(4 + Math.min(2, read) + Math.min(2, figures) * 0.5 + (depth.maxChars >= 6000 ? 0.5 : depth.maxChars < 1500 ? -0.5 : 0)),
    narrative: clamp(5 + depthNarrative(depth)),
    payoff: clamp(5 + (knowledge ? 1 : 0) + (read >= 2 ? 1 : 0)),
    relevance,
    // One fully read source can carry a story (5); independent reads and corroboration add more.
    evidence: clamp(3 + read * 2 + (cor.level === 'corroborated' ? 1 : 0)),
    reliable: read >= 1,
    isMajor: pubs >= 8,
    ongoing: pubs >= 8,
    elementary: false,
    contemporaryHook: true,
    aiPrimary: AI_TITLE.test(title),
    whyNow: ageH == null ? '' : `최근 ${Math.round(ageH)}시간 안에 ${pubs}개 매체가 보도`,
    angle: '',
    category: subject,
    subtopic: null,
    functions: knowledge ? ['something_new', 'in_the_know'] : pubs >= 5 ? ['must_know'] : ['in_the_know'],
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
  lines.push(`휴리스틱 적합도 ${s.suitability} (호기심 ${s.scores.curiosity}, 이해 ${s.scores.understanding}, 오늘 읽을 이유 ${s.scores.relevance}, 근거 ${s.scores.evidence}) — AI 편집 판단 아님`);
  return lines;
}

export async function buildPreview(res: IngestResult, fetcher: Fetcher, sourceSubject: (a: Article) => string, opts: PreviewOptions = {}): Promise<Preview> {
  const now = opts.now ?? new Date();
  const polite = politeFetcher(fetcher, opts.minGapMs ?? 1500);
  const robots = new RobotsCache(polite);
  const formExcluded: Preview['formExcluded'] = [];
  const pool = choosePool(res, opts.poolSize ?? 24, sourceSubject, formExcluded);
  let fetches = 0;
  const stories: PreviewStory[] = [];
  const clusters: Cluster[] = [];
  await Promise.all(pool.map(async (c) => {
    const picks = pickArticles(c, opts.perStory ?? 3);
    const records: RetrievalRecord[] = [];
    for (const a of picks) { records.push(await retrieveArticle(a, { fetcher: polite, robots, now: () => new Date() })); fetches++; }
    // Sponsored content is often visible only on the page (byline "… Insights", "Partner content").
    const pageKinds = records.filter((r) => r.status === 'read').map((r) => contentKind({ title: r.title ?? '', url: r.finalUrl ?? r.url, author: r.author }));
    const formReject: ContentKind | null = pageKinds.length > 0 && pageKinds.every((k) => k !== 'story') ? pageKinds[0] : isRoutineNotice(c.title) ? 'routine' : null;
    if (formReject) formExcluded.push({ title: c.title, url: records[0]?.url ?? '', kind: formReject, stage: 'after reading' });
    const cor = corroborate(records);
    const texts = [...c.articles.map((a) => a.title), ...records.flatMap((r) => r.evidence.map((e) => e.text))];
    const cls = classify(texts, sourceSubject(c.articles[0]), { beat: c.freshnessType === 'evergreen' });
    const newest = c.articles.map(sourceTime).filter((t): t is string => !!t).sort().at(-1);
    const ageH = newest ? Math.round(hoursBetween(newest, now) * 10) / 10 : null;
    const scores = heuristicScores(c, cls.subject, cls.sports, cor, ageH, depthOf(records));
    c.scores = scores;
    if (formReject) c.rejectReason = `format: ${KIND_KO[formReject]}`;
    else clusters.push(c);
    const s: Omit<PreviewStory, 'reasoning'> = {
      key: c.key, title: c.title, language: c.articles[0]?.language ?? '', subject: cls.subject, sports: cls.sports,
      publishers: independentPublishers(c), articles: c.articles.length, newestAgeHours: ageH, records, corroboration: cor,
      scores, suitability: suitability(scores), selected: false,
    };
    stories.push({ ...s, reasoning: [] });
  }));
  // One story per event across languages (title clustering works within a language).
  for (const [kept, dup] of crossLanguageDuplicates(stories.filter((st) => clusters.some((c) => c.key === st.key)))) {
    const c = clusters.find((x) => x.key === dup.key)!;
    c.rejectReason = `same event as "${kept.title}" (other language)`;
    clusters.splice(clusters.indexOf(c), 1);
  }
  const sel = selectEdition(clusters, now, [], { subject7d: new Map(), subject30d: new Map(), subtopic7d: new Map() });
  const sizes = assignCardSizes(sel.chosen);
  for (const st of stories) {
    const chosen = sel.chosen.find((c) => c.key === st.key);
    const c = pool.find((x) => x.key === st.key)!;
    st.selected = !!chosen;
    st.form = chosen?.form ?? c.freshnessType;
    st.desk = chosen?.desk ?? clusterDesk(c);
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
    formExcluded,
    leads: (res.leads ?? []).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, 40)
      .map((a) => ({ title: a.title, url: a.url, source: a.publisher, publishedAt: a.publishedAt ?? null })),
    warnings: sel.warnings,
  };
}
