/**
 * Edition data for the static site. Editions are drafts until a human approves
 * publishing; they live outside this public repository (web/editions/ is
 * git-ignored) and the build marks every page as a private preview unless
 * `status` is 'published'.
 */
export interface Edition {
  /** YYYY-MM-DD (Asia/Seoul). */
  date: string;
  status: 'preview' | 'published';
  /** One or two sentences that open the homepage. */
  intro?: string;
  stories: Story[];
  briefs: Brief[];
  /** How this edition was produced, shown in the preview banner (e.g. manual demonstration). */
  provenance?: string;
}

export interface Story {
  /** URL slug, [a-z0-9-]. */
  slug: string;
  headline: string;
  /** Concise standfirst under the headline (one or two sentences). */
  standfirst: string;
  /** The compelling question or discovery the homepage preview poses. */
  question: string;
  /** Discovery domain shown to readers, e.g. '세계', '과학', '역사'. */
  domain: string;
  /** Where the story happens, e.g. '브라질', '유럽'. */
  place?: string;
  form: 'current' | 'evergreen';
  sections: Section[];
  /** Compact explainer: only when it materially aids comprehension. */
  explainer?: { title: string; items: { term: string; text: string }[] };
  /** Compact timeline: only when chronology matters. */
  timeline?: { title: string; events: { when: string; what: string }[] };
  sources: Source[];
}

/**
 * Paragraph text supports **bold** (use sparingly) and citation markers [n]
 * (or [n][m]) that refer to `sources` by number.
 */
export interface Section { heading?: string; paragraphs: string[] }

export interface Source {
  n: number;
  publisher: string;
  author?: string;
  title: string;
  url: string;
  /** ISO timestamp of publication (or last modification when that is all we have). */
  published?: string;
  /** Access level actually achieved, e.g. '원문 확인'. */
  access: string;
  note?: string;
}

/** One complete sentence with its verified source. */
export interface Brief { text: string; url: string; publisher: string }
