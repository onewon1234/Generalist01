/**
 * Cross-source checks over a story's retrieval records.
 * Only records with status 'read' count. A figure is corroborated when it
 * appears in evidence from at least two read articles by different publishers.
 */
import { publisherKey } from '../cluster.ts';
import type { RetrievalRecord } from './retrieve.ts';

/** Calendar figures ("27일", "2023년", "10월") are shared by every report of a day and prove nothing. */
const DATE_LIKE = /^\d+(일|년|월|years|days)$/;

export interface Corroboration {
  /** Publishers whose article text was actually read. */
  readPublishers: string[];
  /** Records fetched but not read (any reason), with the reason. */
  unread: { url: string; publisher: string; status: string }[];
  /** Figures stated by ≥ 2 independent read articles. */
  corroboratedFigures: { figure: string; publishers: string[] }[];
  /** Figures found in only one read article. */
  singleSourceFigures: { figure: string; publisher: string }[];
  /** 'corroborated' (≥2 read publishers), 'single-source' (1), 'unverified' (0). */
  level: 'corroborated' | 'single-source' | 'unverified';
}

export function corroborate(records: RetrievalRecord[]): Corroboration {
  const read = records.filter((r) => r.status === 'read');
  const unread = records.filter((r) => r.status !== 'read').map((r) => ({ url: r.url, publisher: r.publisher, status: r.status }));
  const pubs = [...new Set(read.map((r) => publisherKey(r.publisher)))];
  const byFigure = new Map<string, Set<string>>();
  const label = new Map<string, string>();
  for (const r of read) {
    const k = publisherKey(r.publisher);
    label.set(k, r.publisher);
    for (const e of r.evidence) for (const f of e.figures) {
      if (DATE_LIKE.test(f)) continue;
      if (!byFigure.has(f)) byFigure.set(f, new Set());
      byFigure.get(f)!.add(k);
    }
  }
  const corroboratedFigures: Corroboration['corroboratedFigures'] = [];
  const singleSourceFigures: Corroboration['singleSourceFigures'] = [];
  for (const [figure, ps] of byFigure) {
    if (ps.size >= 2) corroboratedFigures.push({ figure, publishers: [...ps].map((p) => label.get(p)!) });
    else singleSourceFigures.push({ figure, publisher: label.get([...ps][0])! });
  }
  return {
    readPublishers: pubs.map((p) => label.get(p)!),
    unread,
    corroboratedFigures,
    singleSourceFigures,
    level: pubs.length >= 2 ? 'corroborated' : pubs.length === 1 ? 'single-source' : 'unverified',
  };
}
