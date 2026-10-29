/**
 * Public research pack for the unattended editorial session.
 *
 * The scheduled Claude session cannot reach news sites, so the morning research
 * workflow hands it the pipeline's findings through the public repository. Only
 * what may be public goes in: titles, URLs, outlets, times, access status and
 * counts, the figures found, and one short opening sentence per read source
 * (at most LEDE_CHARS characters) as a pointer to the fact. No article text,
 * no long excerpts, nothing secret. Heuristic scores are labelled as such.
 */
import type { Preview } from './preview.ts';

export const LEDE_CHARS = 160;

const cut = (s: string | null | undefined, max = LEDE_CHARS) => {
  if (!s) return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return [...t].length > max ? [...t].slice(0, max - 1).join('') + '…' : t;
};

export interface ResearchPack {
  date: string;
  generatedAt: string;
  note: string;
  counts: { sources: number; sourcesOk: number; candidates: number; articleRequests: number };
  stories: {
    title: string; desk: string | null; subject: string; form: string | null; language: string;
    publishers: number; newestAgeHours: number | null; heuristicSuitability: number; heuristicPick: boolean; excluded: string | null;
    figures: string[];
    sources: { publisher: string; url: string; publishedAt: string | null; access: string; textChars: number; lede: string | null; figures: string[] }[];
  }[];
  briefs: { title: string; tag: string; publisher: string; url: string | null; publishedAt: string | null; lede: string | null }[];
  leads: { title: string; url: string; source: string; publishedAt: string | null }[];
  formExcluded: { title: string; url: string; kind: string }[];
  warnings: string[];
}

export function toPack(p: Preview, date: string): ResearchPack {
  return {
    date,
    generatedAt: p.generatedAt,
    note: 'Rule-based research (no AI). Ledes are short pointers, not article text; read the sources before writing. heuristicPick/heuristicSuitability are not editorial judgment.',
    counts: { sources: p.ingest.sources, sourcesOk: p.ingest.sourcesOk, candidates: p.pool, articleRequests: p.fetches },
    stories: p.stories.map((s) => ({
      title: s.title, desk: s.desk ?? null, subject: s.subject, form: s.form ?? null, language: s.language,
      publishers: s.publishers, newestAgeHours: s.newestAgeHours, heuristicSuitability: s.suitability, heuristicPick: s.selected,
      excluded: s.rejectReason ?? null,
      figures: s.corroboration.corroboratedFigures.map((f) => f.figure),
      sources: s.records.map((r) => ({
        publisher: r.publisher, url: r.finalUrl ?? r.url, publishedAt: r.pagePublishedAt ?? r.feedPublishedAt, access: r.status, textChars: r.textChars,
        lede: r.status === 'read' ? cut(r.evidence.find((e) => e.kind === 'lede')?.text ?? r.evidence[0]?.text) : null,
        figures: [...new Set(r.evidence.flatMap((e) => e.figures))].slice(0, 12),
      })),
    })),
    briefs: p.briefs.map((b) => ({ title: b.title, tag: b.tag, publisher: b.sourcePublisher, url: b.links[0] ?? null, publishedAt: b.publishedAt, lede: cut(b.sourceSentence) })),
    leads: p.leads,
    formExcluded: (p.formExcluded ?? []).map((x) => ({ title: x.title, url: x.url, kind: x.kind })),
    warnings: p.warnings,
  };
}

/** Longest free-text field in a pack, for the test that nothing long leaks. */
export function longestText(pack: ResearchPack): number {
  return Math.max(0, ...pack.stories.flatMap((s) => s.sources.map((x) => [...(x.lede ?? '')].length)), ...pack.briefs.map((b) => [...(b.lede ?? '')].length));
}
