/**
 * Deterministic evidence extraction from an article's paragraphs.
 * Produces short attributed snippets (≤ 240 chars each, ≤ 1000 chars per
 * article in total) of the kinds a fact checker needs: the lede, figures,
 * direct quotes and attributed statements. No AI.
 */
export type EvidenceKind = 'lede' | 'figure' | 'quote' | 'statement';

export interface Evidence {
  kind: EvidenceKind;
  text: string;
  /** Paragraph index in the source article. */
  paragraph: number;
  /** Normalised figures found in the snippet (e.g. "107명", "1.0%"). */
  figures: string[];
}

export const SNIPPET_MAX = 240;
export const EVIDENCE_BUDGET = 1000;

const UNIT_KO = '(?:%|퍼센트|%p|포인트|명|가구|건|개|곳|원|달러|유로|엔|위안|억|조|만|천|배|년|개월|일|시간|분|km|㎞|m|t|톤|도|℃|세)';
const FIGURE_RE = new RegExp(String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:${UNIT_KO}|percent|per cent|million|billion|trillion|bn|m\b|km|kg|people|households|deaths|dead|votes|seats|years|days)`, 'giu');
const QUOTE_RE = /["“”‘’'「」『』]([^"“”‘’'「」『』]{12,})["“”‘’'「」『』]/u;
const ATTRIB_KO = /(말했다|밝혔다|전했다|설명했다|강조했다|주장했다|발표했다|덧붙였다|지적했다|보고했다|추정했다|집계했다|분석했다)/;
const ATTRIB_EN = /\b(said|says|told|according to|announced|reported|estimated|stated|wrote)\b/i;

export function splitSentences(p: string): string[] {
  return p
    .replace(/([.!?…])\s+(?=["“‘(]?[\p{Lu}\p{Script=Hangul}\d])/gu, '$1\u0000')
    .replace(/(다\.)\s*/g, '$1\u0000')
    .split('\u0000').map((s) => s.trim()).filter((s) => s.length >= 15);
}

export function figuresIn(s: string): string[] {
  return [...new Set([...s.matchAll(FIGURE_RE)].map((m) => m[0].replace(/\s+/g, '').replace(/,/g, '').toLowerCase()))];
}

function clip(s: string): string {
  if (s.length <= SNIPPET_MAX) return s;
  const cut = s.slice(0, SNIPPET_MAX - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > SNIPPET_MAX * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

export function extractEvidence(paragraphs: string[]): Evidence[] {
  const out: Evidence[] = [];
  let budget = EVIDENCE_BUDGET;
  const add = (kind: EvidenceKind, text: string, paragraph: number) => {
    const t = clip(text);
    if (t.length > budget || out.some((e) => e.text === t)) return false;
    out.push({ kind, text: t, paragraph, figures: figuresIn(t) });
    budget -= t.length;
    return true;
  };
  // Lede: the first substantive sentence(s).
  // Skip bylines and labels ("Jane Doe | Daily Correspondent"): a lede ends a sentence or is long.
  const firstIdx = paragraphs.findIndex((p) => p.length >= 80 || (p.length >= 30 && /[.!?。]|다\.?$/.test(p)));
  if (firstIdx >= 0) {
    const s = splitSentences(paragraphs[firstIdx]);
    add('lede', s.slice(0, s[0] && s[0].length < 90 ? 2 : 1).join(' '), firstIdx);
  }
  const counts: Record<EvidenceKind, number> = { lede: 1, figure: 0, quote: 0, statement: 0 };
  const limits: Record<EvidenceKind, number> = { lede: 1, figure: 3, quote: 2, statement: 2 };
  paragraphs.forEach((p, i) => {
    for (const s of splitSentences(p)) {
      if (out.some((e) => e.text.includes(s.slice(0, 40)))) continue;
      const hasQuote = QUOTE_RE.test(s) && (ATTRIB_KO.test(s) || ATTRIB_EN.test(s));
      const kind: EvidenceKind | null = hasQuote ? 'quote'
        : figuresIn(s).length ? 'figure'
        : ATTRIB_KO.test(s) || ATTRIB_EN.test(s) ? 'statement' : null;
      if (kind && counts[kind] < limits[kind] && add(kind, s, i)) counts[kind]++;
    }
  });
  return out;
}
