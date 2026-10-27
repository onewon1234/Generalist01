/**
 * Source-bias audit: how sources, languages and subjects are distributed at
 * each stage from collection to selection, so over-representation can be
 * traced to the stage that causes it. Deterministic, read-only.
 */
import { publisherKey } from '../cluster.ts';
import type { SourceConfig } from '../collect/registry.ts';
import { broadOf } from '../config.ts';
import type { IngestResult } from '../ingest/ingest.ts';
import type { Article, Cluster } from '../types.ts';
import type { Preview } from './preview.ts';

export type Tally = Record<string, number>;
export interface StageAudit { stage: string; total: number; bySource: Tally; byLanguage: Tally; bySubject?: Tally; note?: string }
export interface SourceAudit {
  stages: StageAudit[];
  /** Clusters where one outlet is counted as two publishers (feed name vs. host name). */
  duplicatePublisherClusters: { title: string; publishers: string[] }[];
  /** Korean-language stories by event location (keyword estimate). */
  koreanStoriesByScope: Tally;
}

const inc = (t: Tally, k: string, n = 1) => { t[k] = (t[k] ?? 0) + n; };

/** Outlet identity across feed names and NAVER host names (e.g. "연합뉴스" = "yna.co.kr"). */
export const OUTLET_ALIASES: Record<string, string> = {
  'yna.co.kr': '연합뉴스', 'yonhapnewstv.co.kr': '연합뉴스TV', 'hani.co.kr': '한겨레', 'bbc.co.uk': 'BBC', 'bbc.com': 'BBC',
  'theguardian.com': 'The Guardian',
};

export function outletOf(a: Pick<Article, 'publisher'>): string {
  const p = a.publisher;
  if (OUTLET_ALIASES[p]) return OUTLET_ALIASES[p];
  if (/^the guardian/i.test(p)) return 'The Guardian';
  if (/^bbc/i.test(p)) return 'BBC';
  return p;
}

/**
 * Event location of a Korean-language story, estimated from its title:
 * 'foreign' when it names another country, foreign leader or institution.
 * An estimate for auditing, not an editorial classification.
 */
const FOREIGN = /미국|美|중국|中|일본|日|러시아|露|우크라|유럽|EU|유로존|영국|英|프랑스|佛|독일|獨|이스라엘|이란|가자|하마스|시리아|요르단|레바논|사우디|튀르키예|인도|파키스탄|베트남|대만|북한|브라질|아르헨|멕시코|캐나다|호주|아프리카|콩고|수단|나토|NATO|유엔|UN|트럼프|시진핑|푸틴|네타냐후|룰라|벨기에|폴란드|스페인|이탈리아|그리스|필리핀|태국|인니|인도네시아|말레이|싱가포르|몽골|현지시간|외신/;
export function koreanScope(title: string, evidence = ''): 'foreign' | 'domestic' {
  return FOREIGN.test(title) || /\(현지시간\)/.test(evidence) ? 'foreign' : 'domestic';
}

function tallyArticles(arts: Article[], src: Map<string, SourceConfig>) {
  const bySource: Tally = {}, byLanguage: Tally = {};
  for (const a of arts) { inc(bySource, a.sourceKey ?? a.publisher); inc(byLanguage, a.language || src.get(a.sourceKey ?? '')?.language || '?'); }
  return { bySource, byLanguage };
}

/** Source of a cluster for stage counts: its most reliable, then first-listed article. */
function leadSource(c: Pick<Cluster, 'articles'>): string {
  const a = [...c.articles].sort((x, y) => (x.reliabilityTier ?? 2) - (y.reliabilityTier ?? 2))[0];
  return a?.sourceKey ?? a?.publisher ?? '?';
}

export function sourceAudit(res: IngestResult, p: Preview, registry: SourceConfig[], topN = 60): SourceAudit {
  const src = new Map(registry.map((s) => [s.key, s]));
  const stages: StageAudit[] = [];

  const collected: StageAudit = { stage: '1. 수집', total: 0, bySource: {}, byLanguage: {} };
  for (const h of res.health) { inc(collected.bySource, h.key, h.items); inc(collected.byLanguage, src.get(h.key)?.language ?? '?', h.items); collected.total += h.items; }
  stages.push(collected);

  const fresh = res.clusters.flatMap((c) => c.articles);
  stages.push({ stage: '2. 신선(시간 기준 통과)', total: fresh.length, ...tallyArticles(fresh, src) });

  const byKey = new Map(res.clusters.map((c) => [c.key, c]));
  const clusterStage = (stage: string, keys: string[], note?: string): StageAudit => {
    const s: StageAudit = { stage, total: keys.length, bySource: {}, byLanguage: {}, note };
    for (const k of keys) { const c = byKey.get(k); if (!c) continue; inc(s.bySource, leadSource(c)); inc(s.byLanguage, c.articles[0]?.language ?? '?'); }
    return s;
  };
  stages.push(clusterStage('3. 이야기 묶음', res.clusters.map((c) => c.key), '묶음의 대표 출처(신뢰 등급이 가장 높은 기사) 기준'));
  stages.push(clusterStage(`4. 후보 순위 상위 ${topN}`, res.candidates.slice(0, topN).map((c) => c.key), '순위: 매체 수 → 기사 수 → 최신순'));

  const pool = clusterStage('5. 조사 후보(원문 확인 대상)', p.stories.map((s) => s.key));
  pool.bySubject = {};
  for (const s of p.stories) inc(pool.bySubject, broadOf(s.subject));
  stages.push(pool);

  const recs = p.stories.flatMap((s) => s.records);
  const tried: StageAudit = { stage: '6. 원문 요청', total: recs.length, bySource: {}, byLanguage: {} };
  const read: StageAudit = { stage: '7. 원문 확인(read)', total: 0, bySource: {}, byLanguage: {} };
  for (const r of recs) {
    const k = r.sourceKey === 'naver-news' ? `naver:${outletOf(r)}` : (r.sourceKey ?? r.publisher);
    const lang = src.get(r.sourceKey ?? '')?.language ?? '?';
    inc(tried.bySource, k); inc(tried.byLanguage, lang);
    if (r.status === 'read') { inc(read.bySource, k); inc(read.byLanguage, lang); read.total++; }
  }
  stages.push(tried, read);

  const sel = p.stories.filter((s) => s.selected);
  const selected = clusterStage('8. 자동 선정', sel.map((s) => s.key));
  selected.bySubject = {};
  for (const s of sel) inc(selected.bySubject, broadOf(s.subject));
  stages.push(selected);

  const duplicatePublisherClusters = res.clusters.flatMap((c) => {
    const keys = c.articles.map((a) => publisherKey(a.publisher));
    const outlets = c.articles.map((a) => publisherKey(outletOf(a)));
    return new Set(keys).size > new Set(outlets).size ? [{ title: c.title, publishers: [...new Set(c.articles.map((a) => a.publisher))] }] : [];
  });

  const koreanStoriesByScope: Tally = {};
  for (const s of p.stories.filter((x) => x.language === 'ko')) {
    inc(koreanStoriesByScope, koreanScope(s.title, s.records.flatMap((r) => r.evidence.map((e) => e.text)).join(' ')));
  }
  return { stages, duplicatePublisherClusters, koreanStoriesByScope };
}

const fmt = (t: Tally, total: number, top = 8) =>
  Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `${k} ${v} (${Math.round((v / Math.max(1, total)) * 100)}%)`).join(', ');

export function renderAudit(a: SourceAudit): string {
  const out = ['# 출처 분포 점검 (단계별)', ''];
  for (const s of a.stages) {
    out.push(`## ${s.stage} — ${s.total}`, `- 언어: ${fmt(s.byLanguage, s.total)}`, `- 출처: ${fmt(s.bySource, s.total, 12)}`);
    if (s.bySubject) out.push(`- 분야: ${fmt(s.bySubject, s.total)}`);
    if (s.note) out.push(`- 기준: ${s.note}`);
    out.push('');
  }
  out.push(`## 같은 매체가 두 매체로 세어진 묶음 — ${a.duplicatePublisherClusters.length}`);
  for (const d of a.duplicatePublisherClusters.slice(0, 15)) out.push(`- ${d.title} (${d.publishers.join(' / ')})`);
  out.push('', `## 한국어 조사 후보의 사건 위치(제목 키워드 추정): ${fmt(a.koreanStoriesByScope, Object.values(a.koreanStoriesByScope).reduce((x, y) => x + y, 0))}`);
  return out.join('\n');
}
