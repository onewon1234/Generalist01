import { DIVERSITY, EDITION, EVERGREEN, FRESHNESS_BONUS, WEIGHTS, broadOf } from './config.ts';
import { deskAdjustment, deskOf, DESK_KO, DESK_PREFERENCE, type Desk } from './desk.ts';
import { checkFreshness } from './freshness.ts';
import { checkRepeat, choosePrimary, independentPublishers, type PublishedRef } from './cluster.ts';
import { hoursBetween } from './text.ts';
import type { CardSize, Cluster, Decision, FreshnessType, Scores } from './types.ts';

/** Weighted 0–100 reader-payoff score (see config.WEIGHTS). */
export function suitability(s: Scores): number {
  const v = s.curiosity * WEIGHTS.curiosity + s.understanding * WEIGHTS.understanding +
    s.narrative * WEIGHTS.narrative + s.payoff * WEIGHTS.payoff +
    s.relevance * WEIGHTS.relevance + s.evidence * WEIGHTS.evidence;
  return Math.round(v * 10 * 100) / 100;
}

/** Mandatory gates. Returns a rejection reason, or null when the cluster may be considered. */
export function gate(c: Cluster, now: Date, recent: PublishedRef[]): string | null {
  const s = c.scores;
  if (!s) return 'not scored';
  if (!s.reliable) return 'sources judged insufficient or unreliable';
  if (s.evidence < EDITION.minEvidence) return `central claims not supportable (evidence ${s.evidence})`;
  choosePrimary(c);
  if (!c.primary) return 'no primary article';
  if (s.elementary && !(s.contemporaryHook && s.relevance >= EVERGREEN.elementaryMinRelevance))
    return 'elementary/definitional topic without a significant current development';
  if (c.freshnessType === 'timely') {
    // Event freshness comes from the newest genuine development, not from whichever article is primary.
    const opts = { isMajor: s.isMajor, ongoing: s.ongoing };
    const checked = c.articles.map((a) => ({ a, fr: checkFreshness(a, now, opts) }));
    const current = checked.filter((x) => x.fr.ok && !x.fr.background).map((x) => x.a);
    if (!current.length) {
      if (checked.some((x) => x.fr.ok)) return 'reports an old event without a new development (background only)';
      const newest = checked.sort((x, y) => (x.fr.ageHours ?? Infinity) - (y.fr.ageHours ?? Infinity))[0];
      return `freshness: ${newest?.fr.reason ?? 'no dated source'}`;
    }
    // Primary must carry the new development itself.
    c.primary = choosePrimary({ ...c, articles: current });
    if (!c.primary) return 'no primary article';
    if (independentPublishers(c) < 2 && (c.primary.reliabilityTier ?? 2) !== 1) return 'needs a second independent source';
    const rep = checkRepeat(c, recent);
    if (rep.repeat) return `already covered on ${rep.match?.issueDate}`;
    c.isNewDevelopment = rep.newDevelopment;
  } else {
    const rep = checkRepeat(c, recent);
    if (rep.repeat || rep.match) return `evergreen topic already covered on ${rep.match?.issueDate}`;
    if ((c.suitability ?? 0) < EVERGREEN.minSuitability) return `evergreen suitability ${c.suitability} below ${EVERGREEN.minSuitability}`;
    if (!s.contemporaryHook && Math.min(s.curiosity, s.payoff) < EVERGREEN.strongIdeaWithoutHook) return 'evergreen without a contemporary hook or an unusually strong idea';
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

/** Desk of a cluster: the editor's choice, else derived from category, language and title. */
export function clusterDesk(c: Cluster): Desk {
  const s = c.scores!;
  return s.desk ?? deskOf({ title: c.title, language: c.articles[0]?.language ?? '', category: s.category, aiPrimary: s.aiPrimary });
}

function deskCounts(chosen: Cluster[]): Partial<Record<Desk, number>> {
  const out: Partial<Record<Desk, number>> = {};
  for (const x of chosen) { const d = clusterDesk(x); out[d] = (out[d] ?? 0) + 1; }
  return out;
}

function adjusted(c: Cluster, cov: Coverage, chosen: Cluster[], now: Date): number {
  const s = c.scores!;
  const broad = broadOf(s.category);
  let v = (c.suitability ?? 0) + freshnessBonus(c, now);
  v -= (cov.subject7d.get(broad) ?? 0) * DIVERSITY.per7dStory;
  v -= (cov.subject30d.get(broad) ?? 0) * DIVERSITY.per30dStory;
  if (s.subtopic && (cov.subtopic7d.get(s.subtopic.toLowerCase()) ?? 0) > 0) v -= DIVERSITY.sameSubtopic7d;
  // Same subject counts as repetition only within the same desk (a Korean politics
  // story does not repeat a Brazilian one).
  const desk = clusterDesk(c);
  v -= chosen.filter((x) => broadOf(x.scores!.category) === broad && clusterDesk(x) === desk).length * DIVERSITY.sameSubjectInEdition;
  v -= chosen.filter((x) => x.freshnessType === c.freshnessType).length * DIVERSITY.sameFormInEdition;
  // The user's default composition (desk preference): a nudge, never a quota.
  v += deskAdjustment(clusterDesk(c), deskCounts(chosen), c.suitability ?? 0, EDITION.minSuitability);
  return Math.round(v * 100) / 100;
}

export interface Selection { chosen: (Cluster & { form: FreshnessType; desk: Desk })[]; decisions: Decision[]; warnings: string[] }

/**
 * Editor-in-Chief selection. Deterministic given scores and coverage.
 * Greedy by adjusted reader-payoff value: current stories and evergreen pieces
 * compete equally; variety comes from soft penalties (subject, form, recent
 * coverage), never from a mix quota. The only hard cap is the AI cap. Never
 * pads: below EDITION.min the edition is flagged underfilled.
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
  const allowed = (c: Cluster) =>
    !chosen.includes(c as any) &&
    !(c.scores!.aiPrimary && chosen.filter((x) => x.scores!.aiPrimary).length >= EDITION.maxAiPrimary);

  while (chosen.length < EDITION.target) {
    const ranked = eligible.filter(allowed)
      .map((c) => ({ c, v: adjusted(c, cov, chosen, now) }))
      .filter((x) => x.v >= EDITION.minSuitability - 15)
      .sort((a, b) => b.v - a.v || b.c.scores!.payoff - a.c.scores!.payoff);
    const top = ranked[0];
    if (!top) break;
    top.c.adjusted = top.v;
    chosen.push(Object.assign(top.c, { form: top.c.freshnessType, desk: clusterDesk(top.c) }));
    const s = top.c.scores!;
    decisions.push({ stage: 'editor_in_chief', decision: 'selected', reason: `${clusterDesk(top.c)}/${top.c.freshnessType}: suitability ${top.c.suitability}, adjusted ${top.v}; payoff: ${s.readerPayoff || 'n/a'}; why now: ${s.whyNow || 'n/a'}`, clusterKey: top.c.key });
  }

  const forms = new Set(chosen.map((c) => c.form));
  if (chosen.length >= 3 && forms.size === 1) warnings.push(`variety: all ${chosen.length} stories are ${[...forms][0]} pieces; check the edition is more than a news digest (not enforced)`);
  const counts = deskCounts(chosen);
  for (const d of Object.keys(DESK_PREFERENCE) as Desk[]) {
    if ((counts[d] ?? 0) < DESK_PREFERENCE[d].min) warnings.push(`composition: no ${d} (${DESK_KO[d]}) story cleared the bar; not padded`);
  }
  if (chosen.length < EDITION.min) warnings.push(`underfilled: only ${chosen.length} stories passed the gates (minimum ${EDITION.min}); do not approve without review`);
  for (const c of eligible) if (!chosen.includes(c as any)) decisions.push({ stage: 'editor_in_chief', decision: 'rejected', reason: `not selected (adjusted ${adjusted(c, cov, chosen, now)})`, clusterKey: c.key });
  return { chosen, decisions, warnings };
}

/** Visual hierarchy: one large story only when editorially justified (high reader payoff), then medium, then small. */
export function assignCardSizes(chosen: Cluster[]): Map<string, { size: CardSize; featured: boolean }> {
  const out = new Map<string, { size: CardSize; featured: boolean }>();
  const ranked = [...chosen].sort((a, b) => (b.scores!.payoff - a.scores!.payoff) || ((b.adjusted ?? 0) - (a.adjusted ?? 0)));
  const featured = ranked[0] && ranked[0].scores!.payoff >= 7 ? ranked[0] : undefined;
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
