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
  /** Search engines may index the page. Off unless separately approved by the user. */
  indexable?: boolean;
}

/** Desks of the default edition composition (see pipeline/src/desk.ts). */
export type Desk = 'korea' | 'world' | 'economy' | 'tech' | 'explore';

/**
 * Headline Editor record: the previous headline and deck, why they changed,
 * the other edits made to the piece, and the subheadings before and after.
 * Kept with the draft so a human editor can review the judgement.
 */
export interface HeadlineReview {
  before: { headline: string; deck?: string };
  /** Why the new headline tells the story better (specific fact, clarity, accuracy against the body). */
  reason: string;
  /** Body edits made in the same pass, each with its reason. */
  changes?: string[];
  subheads?: { before: (string | undefined)[]; after: (string | undefined)[] };
}

export interface Story {
  /** URL slug, [a-z0-9-]. */
  slug: string;
  /** Final headline chosen by the Headline Editor. */
  headline: string;
  /** Short subtitle that makes the headline concrete (homepage and article). */
  deck: string;
  /** Concise standfirst under the headline (one or two sentences). */
  standfirst: string;
  /** Desk of the default composition. */
  desk: Desk;
  headlineReview?: HeadlineReview;
  /** @deprecated replaced by headline + deck on the homepage. */
  question?: string;
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

/**
 * One item of "오늘의 한 줄": one or two complete sentences with a field tag,
 * a short label for scanning, and the verified source with its publication time.
 */
export interface Brief {
  /** Field tag shown to readers, e.g. '국제', '한국', '경제', '기술', '과학'. */
  tag: BriefTag;
  /** A few words naming the item, for scanning (not a headline fragment of the sentence). */
  label: string;
  /** One scannable line (about 20–48 characters) shown in "오늘의 한 줄"; `text` opens on demand. */
  line: string;
  text: string;
  url: string;
  publisher: string;
  /** ISO publication time of the linked source (checked against the edition date). */
  published: string;
}

export type BriefTag = '한국' | '국제' | '경제' | '기술' | '과학' | '문화' | '사회';
