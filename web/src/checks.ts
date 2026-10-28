/**
 * Deterministic edition checks for the Headline Editor and "짧게 보는 세상".
 * Errors block the build; notes are shown for the editor to judge. Judgement
 * itself (curiosity, accuracy against the body) stays with the editor stage;
 * these checks catch what code can: shape, hype, repetition, dates, duplicates.
 */
import type { Brief, BriefTag, Edition, HeadlineStyle, Story } from './types.ts';

export const HEADLINE_STYLES: HeadlineStyle[] = ['paradox', 'surprising-fact', 'question', 'conflict', 'human', 'connection', 'plain'];
export const BRIEF_TAGS: BriefTag[] = ['한국', '국제', '경제', '기술', '과학', '문화', '사회'];

const HYPE = /충격|경악|역대급|놀라운|소름|대박|무려|발칵|단독|긴급|반드시 알아야|모르면 손해|이것|이유는\?|알고 보니|shocking|you won'?t believe/i;
const len = (s: string) => [...s.replace(/\s+/g, ' ').trim()].length;
const isQuestion = (s: string) => /[?？]\s*$/.test(s.trim());

export interface CheckResult { errors: string[]; notes: string[] }

export function checkHeadlines(e: Edition): CheckResult {
  const errors: string[] = [], notes: string[] = [];
  for (const s of e.stories) {
    const h = s.headline, d = s.deck;
    if (!d) { errors.push(`${s.slug}: missing deck (subtitle)`); continue; }
    if (len(h) < 8 || len(h) > 42) errors.push(`${s.slug}: headline length ${len(h)} (8–42)`);
    if (len(d) < 12 || len(d) > 75) errors.push(`${s.slug}: deck length ${len(d)} (12–75)`);
    if (HYPE.test(h) || HYPE.test(d)) errors.push(`${s.slug}: hype or clickbait wording`);
    if (h.trim() === d.trim()) errors.push(`${s.slug}: deck repeats the headline`);
    const r = s.headlineReview;
    if (!r) { notes.push(`${s.slug}: no Headline Editor record`); continue; }
    if (r.candidates.length < 3) errors.push(`${s.slug}: fewer than 3 headline candidates`);
    if (new Set(r.candidates.map((c) => c.style)).size < 3) errors.push(`${s.slug}: candidates use fewer than 3 different styles`);
    for (const c of r.candidates) if (!HEADLINE_STYLES.includes(c.style)) errors.push(`${s.slug}: unknown headline style ${c.style}`);
    const chosen = r.candidates[r.chosen];
    if (!chosen) errors.push(`${s.slug}: chosen candidate ${r.chosen} does not exist`);
    else if (chosen.headline !== h || chosen.deck !== d) errors.push(`${s.slug}: published headline/deck differ from the chosen candidate`);
    if (!r.reason?.trim()) errors.push(`${s.slug}: no reason recorded for the chosen headline`);
  }
  const questions = e.stories.filter((s) => isQuestion(s.headline)).length;
  if (e.stories.length >= 3 && questions > Math.floor(e.stories.length / 2)) errors.push(`${questions} of ${e.stories.length} headlines are questions; vary the forms`);
  return { errors, notes };
}

/** Hangul/latin character bigrams, for near-duplicate detection between briefs. */
function bigrams(s: string): Set<string> {
  const t = s.replace(/[^\p{L}\p{N}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.max(1, a.size + b.size - inter);
}

/** Edition date at 09:00 KST, the moment the morning edition appears. */
function editionTime(date: string): number { return Date.parse(`${date}T09:00:00+09:00`); }

export const BRIEF_WINDOW_HOURS = 72;

export function checkBriefs(e: Edition): CheckResult {
  const errors: string[] = [], notes: string[] = [];
  const bs = e.briefs;
  if (bs.length && (bs.length < 6 || bs.length > 10)) notes.push(`${bs.length} briefs (usually 6–10)`);
  const mainUrls = new Set(e.stories.flatMap((s) => s.sources.map((x) => normalise(x.url))));
  const at = editionTime(e.date);
  const seen = new Map<string, number>();
  bs.forEach((b, i) => {
    const where = `brief ${i + 1} (${b.label})`;
    if (!BRIEF_TAGS.includes(b.tag)) errors.push(`${where}: unknown tag ${b.tag}`);
    if (!b.label?.trim() || len(b.label) > 24) errors.push(`${where}: label missing or longer than 24 characters`);
    const sentences = b.text.split(/(?<=다\.)\s+/).filter(Boolean).length;
    if (!/다\.$/.test(b.text.trim()) || sentences > 2) errors.push(`${where}: must be one or two complete sentences`);
    const t = Date.parse(b.published);
    if (Number.isNaN(t)) errors.push(`${where}: publication time missing or invalid`);
    else if (t > at) errors.push(`${where}: source published after the edition time`);
    else if (at - t > BRIEF_WINDOW_HOURS * 3_600_000) errors.push(`${where}: source older than ${BRIEF_WINDOW_HOURS} h`);
    const u = normalise(b.url);
    if (seen.has(u)) errors.push(`${where}: same link as brief ${seen.get(u)! + 1}`);
    seen.set(u, i);
    if (mainUrls.has(u)) errors.push(`${where}: repeats a main story (same source)`);
    const g = bigrams(b.text);
    bs.slice(0, i).forEach((o, j) => { if (jaccard(g, bigrams(o.text)) >= 0.45) errors.push(`${where}: near-duplicate of brief ${j + 1}`); });
  });
  return { errors, notes };
}

/** URL identity without tracking parameters or trailing slash. */
export function normalise(u: string): string {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|at_|ocid|traffic_source)/.test(k)) x.searchParams.delete(k);
    return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + (x.search || '')).toLowerCase();
  } catch { return u; }
}

export function storyDeskCounts(stories: Story[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of stories) out[s.desk] = (out[s.desk] ?? 0) + 1;
  return out;
}
