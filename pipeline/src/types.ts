/** Shared domain types for the editorial pipeline. */

export type FreshnessType = 'timely' | 'evergreen';
export type CardSize = 'large' | 'medium' | 'small';

export const FUNCTIONS = [
  'must_know', 'in_the_know', 'essentials', 'good_to_know', 'something_new', 'food_for_thought',
] as const;
export type EditorialFunction = (typeof FUNCTIONS)[number];

/** Values allowed by editorial_log.stage. */
export type Stage =
  | 'news_scout' | 'knowledge_scout' | 'research_analyst'
  | 'content_writer' | 'fact_checker' | 'editor_in_chief';

/** Values allowed by editorial_log.decision. */
export type DecisionKind = 'selected' | 'rejected' | 'flagged' | 'approved' | 'revised';

export interface Decision {
  stage: Stage;
  decision: DecisionKind;
  reason: string;
  clusterKey?: string;
}

/** One discovered article (metadata only; full text is never stored here). */
export interface Article {
  url: string;
  title: string;
  publisher: string;
  language: string;
  /** Source registry key or feed name it came from. */
  sourceKey?: string;
  /** 1 = highest reliability (wire services, major outlets, primary institutions). */
  reliabilityTier?: 1 | 2 | 3;
  /** ISO timestamps. publishedAt/updatedAt as stated by the source; retrievedAt is ours. */
  publishedAt?: string | null;
  updatedAt?: string | null;
  /** Date the described event happened, when known (YYYY-MM-DD). */
  eventDate?: string | null;
  retrievedAt: string;
  /** Short excerpt (≤1000 chars). */
  excerpt?: string | null;
}

/** Editor's evaluation of a candidate (produced by the scoring model call, 0–10 scales). */
export interface Scores {
  significance: number;
  timeliness: number;
  interest: number;
  insight: number;
  novelty: number;
  accessibility: number;
  /** Gate: sources judged sufficient and trustworthy. */
  reliable: boolean;
  /** A major development (allows the extended freshness window). */
  isMajor: boolean;
  /** A significant ongoing story whose latest development is genuinely new. */
  ongoing?: boolean;
  /** Elementary/definitional topic (e.g. "what is compound interest"). */
  elementary: boolean;
  /** Evergreen piece with a concrete present-day hook. */
  contemporaryHook: boolean;
  /** Story is primarily about AI (capped per edition). */
  aiPrimary: boolean;
  whyNow: string;
  angle: string;
  /** Subject slug from table `subjects`. */
  category: string;
  subtopic?: string | null;
  functions: EditorialFunction[];
  rationale?: string;
}

/** A group of articles about the same event or topic. */
export interface Cluster {
  key: string;
  title: string;
  articles: Article[];
  freshnessType: FreshnessType;
  topicKey?: string | null;
  primary?: Article;
  scores?: Scores;
  suitability?: number;
  adjusted?: number;
  rejectReason?: string;
  isNewDevelopment?: boolean;
}
