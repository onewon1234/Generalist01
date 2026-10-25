import { DIVERSITY, EDITION, EVERGREEN, FRESHNESS_BONUS, WEIGHTS, broadOf } from './config.ts';
import { checkFreshness } from './freshness.ts';
import { checkRepeat, choosePrimary, independentPublishers, type PublishedRef } from './cluster.ts';
import { hoursBetween } from './text.ts';
import type { CardSize, Cluster, Decision, Scores } from './types.ts';

export type Bucket = 'timely' | 'discovery' | 'reflection';

/** Weighted 0–100 score (playbook weights; see config.WEIGHTS). */
export function suitability(s: Scores): number {
  const v = s.significance * WEIGHTS.significance + s.timeliness * WEIGHTS.timeliness +
    s.interest * WEIGHTS.interest + s.insight * WEIGHTS.insight +
    s.novelty * WEIGHTS.novelty + s.accessibility * WEIGHTS.accessibility;
  return Math.round(v * 10 * 100) / 100;
}

/**
 * Editorial buckets for the default shape (3–4 timely, 1–2 discovery, 0–1 reflective).
 * Timely = a current development (news, tech, business, science, culture, society).
 * Discovery = recent research or genuinely surprising knowledge.
 * Reflection = history/philosophy/ideas pieces that clear the evergreen bar.
 */
export function buckets(c: Cluster): Bucket[] {
  const f = c.scores?.functions ?? [];
  const out: Bucket[] = [];
  if (c.freshnessType === 'timely' && (f.includes('must_know') || f.includes('in_the_know'))) out.push('timely');
  if (f.includes('something_new') || f.includes('good_to_know')) out.push('discovery');
  if (f.includes('food_for_thought') || (c.freshnessType === 'evergreen' && f.includes('essentials'))) out.push('reflection');
  return out;
}

/** Mandatory gates. Returns a rejection reason, or null when the cluster may be considered. */
export function gate(c: Cluster, now: Date, recent: PublishedRef[]): string | null {
  const s = c.scores;
  if (!s) return 'not scored';
  if (!s.reliable) return 'sources judged insufficient or unreliable';
  choosePrimary(c);
  if (!c.primary) return 'no primary article';
  if (s.elementary && !(s.contemporaryHook && s.significance >= EVERGREEN.elementaryMinSignificance))
    return 'elementary/definitional topic without a significant current development';
  if (c.freshnessType === 'timely') {
    const fr = checkFreshness(c.primary, now, s.isMajor);
    if (!fr.ok) return `freshness: ${fr.reason}`;
    if (fr.background) return 'primary describes an old event (background only)';
    if (independentPublishers(c) < 2 && (c.primary.reliabilityTier ?? 2) !== 1) return 'needs a second independent source';
    const rep = checkRepeat(c, recent);
    if (rep.repeat) return `already covered on ${rep.match?.issueDate}`;
    c.isNewDevelopment = rep.newDevelopment;
  } else {
    const rep = checkRepeat(c, recent);
    if (rep.repeat || rep.match) return `evergreen topic already covered on ${rep.match?.issueDate}`;
    if ((c.suitability ?? 0) < EVERGREEN.minSuitability) return `evergreen suitability ${c.suitability} below ${EVERGREEN.minSuitability}`;
    if (!s.contemporaryHook && s.novelty < EVERGREEN.noveltyWithoutHook) return 'evergreen without a contemporary hook or exceptional novelty';
  }
  if ((c.suitability ?? 0) < EDITION.minSuitability) return `suitability ${c.suitability} below ${EDITION.minSuitability}`;
  return null;
}

export interface Coverage { subject7d: Map<string, number>; subject30d: Map<string, number>; subtopic7d: Map<string, number> }

/** Hours since the newest source in the cluster was published (null when undated or evergreen). */
export function newestAgeHours(c: Cluster, now: Date): number | null {
  const dates = c.articles.map((a) => a.publishedAt).filter((d): d is string => !!d);
  if (!dates.length || c.freshnessType !== 'timely') return null;
  return Math.max(0, Math.round(hoursBetween(dates.sort().at(-1)!, now) * 10) / 10);
}

function freshnessBonus(c: Cluster, now: Date): number {
  const age = newestAgeHours(c, now);
  if (age === null) return 0;
  return FRESHNESS_BONUS.find((b) => age <= b.maxHours)?.bonus ?? 0;
}

function adjusted(c: Cluster, cov: Coverage, chosen: Cluster[], now: Date): number {
  const s = c.scores!;
  const broad = broadOf(s.category);
  let v = (c.suitability ?? 0) + freshnessBonus(c, now);
  v -= (cov.subject7d.get(broad) ?? 0) * DIVERSITY.per7dStory;
  v -= (cov.subject30d.get(broad) ?? 0) * DIVERSITY.per30dStory;
  if (s.subtopic && (cov.subtopic7d.get(s.subtopic.toLowerCase()) ?? 0) > 0) v -= DIVERSITY.sameSubtopic7d;
  v -= chosen.filter((x) => broadOf(x.scores!.category) === broad).length * DIVERSITY.sameSubjectInEdition;
  return Math.round(v * 100) / 100;
}

export interface Selection { chosen: (Cluster & { bucket: Bucket | 'fill' })[]; decisions: Decision[]; warnings: string[] }

/**
 * Editor-in-Chief selection. Deterministic given scores and coverage:
 * fill each bucket's minimum, then top up timely news (the publication's centre of gravity),
 * then discovery, then best remaining — honouring the per-subject cap and the AI cap.
 * Never pads: below EDITION.min the edition is flagged underfilled.
 */
export function selectEdition(candidates: Cluster[], now: Date, recent: PublishedRef[], cov: Coverage): Selection {
  const decisions: Decision[] = [];
  const warnings: string[] = [];
  const eligible: Cluster[] = [];
  for (const c of candidates) {
    if (c.scores) c.suitability = suitability(c.scores);
    const reason = gate(c, now, recent);
    if (reason) {
      c.rejectReason = reason;
      decisions.push({ stage: 'research_analyst', decision: 'rejected', reason, clusterKey: c.key });
    } else eligible.push(c);
  }

  const chosen: Selection['chosen'] = [];
  const inBucket = (b: Bucket) => chosen.filter((x) => x.bucket === b).length;
  const allowed = (c: Cluster) =>
    !chosen.includes(c as any) &&
    chosen.filter((x) => broadOf(x.scores!.category) === broadOf(c.scores!.category)).length < EDITION.maxPerBroadSubject &&
    !(c.scores!.aiPrimary && chosen.filter((x) => x.scores!.aiPrimary).length >= EDITION.maxAiPrimary);
  const pick = (bucket: Bucket | 'fill') => {
    const pool = bucket === 'fill' ? eligible : eligible.filter((c) => buckets(c).includes(bucket));
    const ranked = pool.filter(allowed)
      .map((c) => ({ c, v: adjusted(c, cov, chosen, now) }))
      .filter((x) => x.v >= EDITION.minSuitability - 15)
      .sort((a, b) => b.v - a.v || b.c.scores!.significance - a.c.scores!.significance);
    const top = ranked[0];
    if (!top) return false;
    top.c.adjusted = top.v;
    const assigned: Bucket | 'fill' = bucket === 'fill' ? (buckets(top.c)[0] ?? 'fill') : bucket;
    chosen.push(Object.assign(top.c, { bucket: assigned }));
    decisions.push({ stage: 'editor_in_chief', decision: 'selected', reason: `${assigned}: suitability ${top.c.suitability}, adjusted ${top.v}; why now: ${top.c.scores!.whyNow || 'n/a'}`, clusterKey: top.c.key });
    return true;
  };

  // 1. minimums
  for (const { bucket, min } of EDITION.mix) {
    for (let i = 0; i < min; i++) if (!pick(bucket)) { warnings.push(`only ${inBucket(bucket)} "${bucket}" stories qualified (starting point is ${min})`); break; }
  }
  // 2. top up: each open slot goes to the best story in any bucket still under its maximum
  //    (minimums already guarantee the timely core; quality decides the rest)
  const openBucket = (c: Cluster) => buckets(c).find((b) => inBucket(b) < (EDITION.mix.find((m) => m.bucket === b)?.max ?? 0));
  while (chosen.length < EDITION.target) {
    const best = eligible.filter((c) => allowed(c) && openBucket(c))
      .map((c) => ({ c, v: adjusted(c, cov, chosen, now) }))
      .filter((x) => x.v >= EDITION.minSuitability - 15)
      .sort((a, b) => b.v - a.v || b.c.scores!.significance - a.c.scores!.significance)[0];
    if (!best || !pick(openBucket(best.c)!)) break;
  }
  // 3. best remaining, if still short
  while (chosen.length < EDITION.target && pick('fill')) { /* fill */ }

  if (chosen.length < EDITION.min) warnings.push(`underfilled: only ${chosen.length} stories passed the gates (minimum ${EDITION.min}); do not approve without review`);
  for (const c of eligible) if (!chosen.includes(c as any)) decisions.push({ stage: 'editor_in_chief', decision: 'rejected', reason: `not selected (adjusted ${adjusted(c, cov, chosen, now)})`, clusterKey: c.key });
  return { chosen, decisions, warnings };
}

/** Visual hierarchy: one large story only when editorially justified (high significance), then medium, then small. */
export function assignCardSizes(chosen: Cluster[]): Map<string, { size: CardSize; featured: boolean }> {
  const out = new Map<string, { size: CardSize; featured: boolean }>();
  const ranked = [...chosen].sort((a, b) => (b.scores!.significance - a.scores!.significance) || ((b.adjusted ?? 0) - (a.adjusted ?? 0)));
  const featured = ranked[0] && ranked[0].scores!.significance >= 7 ? ranked[0] : undefined;
  let medium = 0;
  for (const c of ranked) {
    if (c === featured) out.set(c.key, { size: 'large', featured: true });
    else if (medium < 2) { out.set(c.key, { size: 'medium', featured: false }); medium++; }
    else out.set(c.key, { size: 'small', featured: false });
  }
  return out;
}

export function coverageFrom(rows: { category: string; subtopic: string | null; stories: number; window: '7d' | '30d' }[]): Coverage {
  const cov: Coverage = { subject7d: new Map(), subject30d: new Map(), subtopic7d: new Map() };
  for (const r of rows) {
    const broad = broadOf(r.category);
    const m = r.window === '7d' ? cov.subject7d : cov.subject30d;
    m.set(broad, (m.get(broad) ?? 0) + r.stories);
    if (r.window === '7d' && r.subtopic) cov.subtopic7d.set(r.subtopic.toLowerCase(), (cov.subtopic7d.get(r.subtopic.toLowerCase()) ?? 0) + r.stories);
  }
  return cov;
}
