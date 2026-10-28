/**
 * Deterministic edition checks for the Headline Editor and "짧게 보는 세상".
 * Errors block the build; notes are shown for the editor to judge. Judgement
 * itself (curiosity, accuracy against the body) stays with the editor stage;
 * these checks catch what code can: shape, hype, repetition, dates, duplicates.
 */
import type { Brief, BriefTag, Edition, Story } from './types.ts';

export const BRIEF_TAGS: BriefTag[] = ['한국', '국제', '경제', '기술', '과학', '문화', '사회'];

const HYPE = /충격|경악|역대급|놀라운|소름|대박|무려|발칵|단독|긴급|반드시 알아야|모르면 손해|이것|이유는\?|알고 보니|shocking|you won'?t believe/i;
const len = (s: string) => [...s.replace(/\s+/g, ' ').trim()].length;

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
    if (!s.headlineReview) notes.push(`${s.slug}: no Headline Editor record`);
    else if (!s.headlineReview.reason?.trim()) errors.push(`${s.slug}: headline change has no reason`);
    notes.push(...checkSubheads(s));
  }
  return { errors, notes };
}

/**
 * Subheadings that could stand over any article ("배경", "앞으로", "~하는 것",
 * "고칠 수 있을까") tell the reader nothing about the next section. Notes only:
 * a short natural subheading can be right, and the editor decides.
 */
const GENERIC_SUBHEAD = /^(배경|앞으로|전망|의미|결론|정리|남은 (과제|질문)|그 ?다음|왜 중요한가|무엇이 (바뀌었|달라졌)나|.{0,6}까지|.*(말해 주는|바뀐|남은|중요한) 것|.*(고칠|막을|바꿀) 수 있을까)\??$/;
export function checkSubheads(s: Story): string[] {
  const out: string[] = [];
  const hs = s.sections.map((x) => x.heading).filter((h): h is string => !!h);
  for (const h of hs) {
    if (GENERIC_SUBHEAD.test(h.trim())) out.push(`${s.slug}: generic subheading "${h}" (name the event, finding or change)`);
    if (len(h) > 30) out.push(`${s.slug}: long subheading "${h}" (${len(h)} characters)`);
  }
  if (new Set(hs).size < hs.length) out.push(`${s.slug}: repeated subheading`);
  return out;
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
    errors.push(...checkLine(b).map((x) => `${where}: ${x}`));
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

/** Wording that keeps certainty: if the full text uses one, the one-line version must keep its kind. */
const HEDGES: [string, RegExp][] = [
  ['plan', /계획|추진|예정|방침|검토/],
  ['possibility', /가능성|전망|우려|예상|관측/],
  ['suspicion', /의심|혐의|의혹/],
];
const ATTRIBUTED = /밝혔|따르면|주장|말했|전했|보고 있|보고했|발표/;
const KO_COUNT: Record<string, string> = { 한: '1', 두: '2', 세: '3', 네: '4', 다섯: '5', 여섯: '6', 일곱: '7', 여덟: '8', 아홉: '9', 열: '10' };
/** Digits in the text, plus native Korean counts before a noun ("두 남성" → 2). */
function numbers(s: string): Set<string> {
  const out = new Set((s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(/,/g, '')));
  for (const m of s.matchAll(/(?<![가-힣])(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열) ?(?=[가-힣])/g)) out.add(KO_COUNT[m[1]]);
  return out;
}

/**
 * "오늘의 한 줄": the line must fit on one row of a phone (≤ 48 characters),
 * carry no number the full text lacks, and keep the full text's hedges and
 * attribution (a quotation mark, or the speaker named first as in "금융위, …", counts as attribution).
 */
export function checkLine(b: Brief): string[] {
  const out: string[] = [];
  const l = b.line?.trim() ?? '';
  if (!l) return ['one-line version missing'];
  if (len(l) > 48) out.push(`line longer than 48 characters (${len(l)})`);
  if (l === b.text.trim()) out.push('line repeats the full text');
  if (HYPE.test(l)) out.push('hype wording in the line');
  const have = numbers(b.text);
  for (const n of numbers(l)) if (!have.has(n)) out.push(`line has a number (${n}) the text does not`);
  const quoted = /["“”'‘’]/.test(l);
  /** Korean headline grammar names the speaker first: "금융위, …". */
  const actorFirst = /^[^\s,]{1,12}( [^\s,]{1,8})?,/.test(l);
  for (const [kind, re] of HEDGES) if (re.test(b.text) && !re.test(l) && !quoted) out.push(`line drops the ${kind} wording of the text`);
  if (ATTRIBUTED.test(b.text) && !quoted && !actorFirst && !ATTRIBUTED.test(l) && HEDGES.some(([, re]) => re.test(b.text))) out.push('line drops the attribution of a claim');
  return out;
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
