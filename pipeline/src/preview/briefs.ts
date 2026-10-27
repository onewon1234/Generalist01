/**
 * "짧게 보는 세상" (world in brief): useful stories that do not make the main
 * selection, each to be told in one complete, self-contained Korean sentence.
 *
 * This module is deterministic (no AI):
 * - chooseBriefs: picks candidates from the researched pool that are not main
 *   stories or the same event as one, have at least one article actually read,
 *   and come with a usable source sentence; one per event.
 * - modality: labels how certain the source statement is (fact, attributed
 *   claim, allegation, scheduled, forecast, possibility) so the sentence keeps it.
 * - validateBrief: checks a written sentence against its candidate: one
 *   sentence, numbers present in the evidence, certainty preserved, link to a
 *   read source, no hype words.
 * The sentence itself is written in the writer stage (subscription-based or
 * human), never invented by rules.
 */
import { anchorWords, properNouns } from '../ingest/group.ts';
import { figuresIn } from '../research/evidence.ts';
import type { PreviewStory } from './preview.ts';

export type Modality = 'fact' | 'attributed' | 'allegation' | 'scheduled' | 'forecast' | 'possibility';

const MOD_RE: Record<Exclude<Modality, 'fact'>, RegExp> = {
  allegation: /의혹|혐의|고발|기소됐|피의자|alleg|accus|charged with|suspected of/i,
  possibility: /가능성|수도 있|우려|어려울|쉽지 않|불투명|\bmay\b|\bmight\b|\bcould\b|possib|risk of/i,
  forecast: /전망|예상|관측|내다봤|것으로 보인|보인다|추정|expected to|forecast|likely to|projected|predict/i,
  scheduled: /예정|계획|추진|방침|착수|시작될|개최한다|\bwill\b|\bplans? to\b|set to|scheduled|to be held/i,
  attributed: /밝혔다|말했다|전했다|따르면|알려졌|주장|발표했|설명했|강조했|\bsaid\b|\bsays\b|according to|announced|told|reported|claimed/i,
};

/** Korean expressions that keep each certainty level in the written sentence. */
const KO_HEDGE: Record<Exclude<Modality, 'fact'>, RegExp> = {
  allegation: /의혹|혐의|기소|고발|주장|따르면/,
  possibility: /가능성|수도 있|우려|어려울|쉽지 않|불투명|않을 수/,
  forecast: /전망|예상|관측|내다|것으로 보|추정|어려울 것/,
  scheduled: /예정|계획|추진|방침|할 것|하기로|착수/,
  attributed: /밝혔|말했|전했|따르면|주장|발표|설명했|강조했|보도했|보고했|집계했|알려졌|공개한|보고 있/,
};

export function modality(text: string): Modality[] {
  const out = (Object.keys(MOD_RE) as (keyof typeof MOD_RE)[]).filter((k) => MOD_RE[k].test(text));
  return out.length ? out : ['fact'];
}

export interface BriefCandidate {
  key: string;
  title: string;
  subject: string;
  /** The source sentence the brief must be faithful to (evidence lede of a read article). */
  sourceSentence: string;
  sourcePublisher: string;
  /** Read (verified) article URLs; the brief links to one of them. */
  links: string[];
  /** All evidence text from read articles, for the number check. */
  evidenceText: string;
  modality: Modality[];
  reason: string;
}

/** Reviews, opinion and sponsored pieces are not news items. */
const NOT_NEWS = /\breview\b|리뷰|사설|칼럼|\bopinion\b|기고|sponsored|in partnership with/i;

const HYPE = /충격|경악|역대급|놀라운|드디어|결국|무려|대박|초유의|발칵|shock|stunning|bombshell/i;
/** Source sentences longer than this rarely compress into one accurate sentence. */
const MAX_SOURCE_SENTENCE = 240;

function names(title: string): Set<string> {
  return /\p{Script=Hangul}/u.test(title) ? anchorWords(title) : properNouns(title);
}

/** Same event as a main story: shared specific names (Korean 4+ syllable anchors, or 2+ English proper nouns). */
export function overlapsMain(s: Pick<PreviewStory, 'title'>, mains: Pick<PreviewStory, 'title'>[]): boolean {
  const n = names(s.title);
  return mains.some((m) => {
    const shared = [...names(m.title)].filter((w) => n.has(w)).length;
    return /\p{Script=Hangul}/u.test(s.title) ? shared >= 1 : shared >= 2;
  });
}

export interface BriefOptions { max?: number }

export function chooseBriefs(stories: PreviewStory[], opts: BriefOptions = {}): { briefs: BriefCandidate[]; excluded: { title: string; reason: string }[] } {
  const mains = stories.filter((s) => s.selected);
  const excluded: { title: string; reason: string }[] = [];
  const out: BriefCandidate[] = [];
  const ranked = stories.filter((s) => !s.selected)
    .sort((a, b) => b.corroboration.readPublishers.length - a.corroboration.readPublishers.length || b.suitability - a.suitability);
  for (const s of ranked) {
    const read = s.records.filter((r) => r.status === 'read');
    const lede = read.flatMap((r) => r.evidence.filter((e) => e.kind === 'lede').map((e) => ({ e, r })))[0];
    let why: string | null = null;
    if (!read.length) why = '원문 확인 없음';
    else if (s.sports) why = '스포츠 결과';
    else if (NOT_NEWS.test(s.title)) why = '리뷰·의견 기사';
    else if (overlapsMain(s, mains)) why = '메인 기사와 같은 사건';
    else if (!lede) why = '핵심 문장 없음';
    else if (lede.e.text.length > MAX_SOURCE_SENTENCE || lede.e.text.endsWith('…')) why = '한 문장으로 정확히 줄이기 어려움';
    else if (out.some((b) => overlapsMain(s, [{ title: b.title }]))) why = '다른 브리프와 같은 사건';
    if (why) { excluded.push({ title: s.title, reason: why }); continue; }
    out.push({
      key: s.key, title: s.title, subject: s.subject,
      sourceSentence: lede!.e.text, sourcePublisher: lede!.r.publisher,
      links: read.map((r) => r.url),
      evidenceText: [s.title, ...read.flatMap((r) => [r.title ?? '', ...r.evidence.map((e) => e.text)])].join('\n'),
      modality: modality(lede!.e.text),
      reason: `원문 확인 ${read.length}건${s.corroboration.level === 'corroborated' ? ' · 교차 확인' : ''}`,
    });
    if (out.length >= (opts.max ?? Infinity)) break;
  }
  return { briefs: out, excluded };
}

export interface BriefCheck { ok: boolean; issues: string[] }

/** Normalised numbers in a text: "1만60명" and "10,060" style digits, as plain digit strings. */
function numbers(text: string): string[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ''));
}

const fmt = (x: number) => String(Math.round(x * 1000) / 1000);

/**
 * Numbers an evidence text supports once English units are written the Korean
 * way: "$16.2bn" → 162(억), "$2 trillion" → 2(조), "£60m" → 6000(만).
 */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const WORD_RE = new RegExp(`\\b(${WORDS.join('|')}|dozen|hundred|thousand)\\b`, 'gi');
const WORD_VAL: Record<string, string> = { dozen: '12', hundred: '100', thousand: '1000' };

function evidenceNumbers(text: string): Set<string> {
  const out = new Set(numbers(text));
  // English number words ("killed nine people")
  for (const m of text.matchAll(WORD_RE)) { const w = m[1].toLowerCase(); out.add(WORD_VAL[w] ?? String(WORDS.indexOf(w))); }
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(bn|billion|tn|trillion|m|million)\b/gi)) {
    const v = Number(m[1].replace(/,/g, ''));
    const u = m[2].toLowerCase();
    if (u === 'bn' || u === 'billion') { out.add(fmt(v * 10)); if (v >= 1000) out.add(fmt(v / 1000)); }
    else if (u === 'tn' || u === 'trillion') out.add(fmt(v));
    else { out.add(fmt(v * 100)); if (v >= 100) out.add(fmt(v / 100)); }
  }
  return out;
}

export function validateBrief(sentence: string, link: string, c: BriefCandidate): BriefCheck {
  const issues: string[] = [];
  const s = sentence.trim();
  if (/\n/.test(s)) issues.push('줄바꿈이 있음');
  if (!/다\.$/.test(s)) issues.push('완결된 평서문(…다.)으로 끝나지 않음');
  const inner = s.slice(0, -2);
  if (/다\.\s|[.!?]\s+\S/.test(inner)) issues.push('두 문장 이상');
  if (s.length < 25) issues.push('너무 짧아 주체·결과가 빠졌을 가능성');
  if (s.length > 170) issues.push('너무 김(170자 초과)');
  if (!c.links.includes(link)) issues.push('링크가 원문 확인된 출처가 아님');
  const evNums = new Set([...evidenceNumbers(c.evidenceText), ...figuresIn(c.evidenceText).flatMap(numbers)]);
  for (const n of numbers(s)) if (!evNums.has(n)) issues.push(`근거에 없는 숫자: ${n}`);
  for (const m of c.modality) {
    if (m === 'fact') continue;
    if (!KO_HEDGE[m].test(s)) issues.push(`원문의 '${MOD_LABEL[m]}' 표현이 문장에서 사라짐`);
  }
  if (HYPE.test(s)) issues.push('과장 표현');
  return { ok: issues.length === 0, issues };
}

export const MOD_LABEL: Record<Modality, string> = {
  fact: '사실', attributed: '발표·주장', allegation: '의혹', scheduled: '예정', forecast: '전망', possibility: '가능성',
};
