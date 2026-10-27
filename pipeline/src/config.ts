/**
 * Adjustable editorial heuristics. These are tuning knobs, not product rules:
 * CLAUDE.md §2 describes the edition shape as tendencies, so the mix below only
 * expresses preferences that selection may override when quality demands it.
 */

/** Weights of the 0–10 reader-payoff scores in suitability (sum = 1). */
export const WEIGHTS = {
  curiosity: 0.18,
  understanding: 0.20,
  narrative: 0.14,
  payoff: 0.20,
  relevance: 0.16,
  evidence: 0.12,
} as const;

/** Extra bar for evergreen pieces so they enrich rather than dominate. */
export const EVERGREEN = {
  minSuitability: 70,
  /** Without a contemporary hook, curiosity and payoff must both reach this (an unusually strong idea). */
  strongIdeaWithoutHook: 8,
  /** Elementary topics need a current development and at least this relevance. */
  elementaryMinRelevance: 8,
} as const;

/**
 * Small bonus by age of the newest source (hours) for current stories.
 * Freshness is valued but never decisive: the range is a few points.
 */
export const FRESHNESS_BONUS: { maxHours: number; bonus: number }[] = [
  { maxHours: 12, bonus: 3 },
  { maxHours: 24, bonus: 2 },
  { maxHours: 48, bonus: 0 },
  { maxHours: 72, bonus: -3 },
  { maxHours: 120, bonus: -5 },
];

/** Freshness signal for timely stories (hours since the newest source). */
export const FRESHNESS = {
  defaultMaxHours: 48,
  majorMaxHours: 72,
  /** A significant ongoing development (isMajor && ongoing) may run longer. */
  ongoingMaxHours: 120,
  /** An article whose event is this many days older than its publication date is background, not news. */
  backgroundEventLagDays: 7,
  /** Tolerated clock skew for publication dates in the future. */
  futureSkewHours: 1,
  /** Items from evergreen sources (registry `evergreen: true`) are kept this long. */
  evergreenMaxDays: 30,
} as const;

/**
 * Edition size and gates. There is no news/feature mix or per-subject quota:
 * stories compete on reader payoff, and variety comes from the soft penalties
 * in DIVERSITY. The only hard cap is AI-centred stories (repetition guard).
 */
export const EDITION = {
  min: 5,
  target: 6,
  max: 7,
  /** Candidates below this suitability are never selected. */
  minSuitability: 55,
  /** Central claims must be supportable: evidence score below this is rejected. */
  minEvidence: 5,
  maxAiPrimary: 1,
} as const;

/** Penalties (suitability points) that keep breadth over 7 and 30 days. */
export const DIVERSITY = {
  per7dStory: 3,
  per30dStory: 0.5,
  sameSubtopic7d: 8,
  sameSubjectInEdition: 6,
  /** Per story already chosen of the same form (current story vs evergreen piece): keeps a portfolio, not a quota. */
  sameFormInEdition: 2,
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
