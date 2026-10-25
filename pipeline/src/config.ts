/**
 * Adjustable editorial heuristics. These are tuning knobs, not product rules:
 * CLAUDE.md §2 describes the edition shape as tendencies, so the mix below only
 * expresses preferences that selection may override when quality demands it.
 */

/** Weights of the 0–10 scores in suitability (sum = 1). */
export const WEIGHTS = {
  significance: 0.25,
  timeliness: 0.20,
  interest: 0.20,
  insight: 0.15,
  novelty: 0.10,
  accessibility: 0.10,
} as const;

/** Extra bar for evergreen pieces so they enrich rather than dominate. */
export const EVERGREEN = {
  minSuitability: 70,
  /** Without a contemporary hook, novelty must be at least this. */
  noveltyWithoutHook: 8,
  /** Elementary topics need a current development and at least this significance. */
  elementaryMinSignificance: 8,
} as const;

/** Small tie-breaking bonus by age of the newest source (hours). */
export const FRESHNESS_BONUS: { maxHours: number; bonus: number }[] = [
  { maxHours: 12, bonus: 5 },
  { maxHours: 24, bonus: 3 },
  { maxHours: 48, bonus: 0 },
  { maxHours: 72, bonus: -5 },
];

/** Freshness signal for timely stories (hours since the newest source). */
export const FRESHNESS = {
  defaultMaxHours: 48,
  majorMaxHours: 72,
  /** An article whose event is this many days older than its publication date is background, not news. */
  backgroundEventLagDays: 7,
  /** Tolerated clock skew for publication dates in the future. */
  futureSkewHours: 1,
} as const;

export const EDITION = {
  min: 5,
  target: 6,
  max: 7,
  /** Candidates below this suitability are never selected. */
  minSuitability: 55,
  maxPerBroadSubject: 2,
  maxAiPrimary: 1,
  /** Preferred shape (tendencies): several timely, one or two discoveries, occasionally a reflection. */
  mix: [
    { bucket: 'timely', min: 3, max: 4 },
    { bucket: 'discovery', min: 1, max: 2 },
    { bucket: 'reflection', min: 0, max: 1 },
  ] as { bucket: 'timely' | 'discovery' | 'reflection'; min: number; max: number }[],
} as const;

/** Penalties (suitability points) that keep breadth over 7 and 30 days. */
export const DIVERSITY = {
  per7dStory: 3,
  per30dStory: 0.5,
  sameSubtopic7d: 8,
  sameSubjectInEdition: 6,
} as const;

/** Narrow subject → broad subject (mirrors subjects.parent_slug). */
const PARENT: Record<string, string> = {
  mathematics: 'science-technology-ai',
  environment: 'science-technology-ai',
  medicine: 'science-technology-ai',
  'architecture-design': 'philosophy-literature-arts-culture',
  law: 'world-politics-society',
  language: 'philosophy-literature-arts-culture',
  anthropology: 'history-civilization-geography',
};

export const BROAD_SUBJECTS = [
  'world-politics-society',
  'economics-finance-business',
  'science-technology-ai',
  'history-civilization-geography',
  'philosophy-literature-arts-culture',
  'psychology-behavior-everyday',
] as const;

export function broadOf(category: string): string {
  return PARENT[category] ?? category;
}
