import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SourceConfig {
  key: string;
  name: string;
  kind: 'rss' | 'naver';
  url: string;
  homepage?: string;
  language: string;
  region: string;
  /** Default subject slug for items from this source. */
  subject: string;
  reliabilityTier: 1 | 2 | 3;
  active: boolean;
  /** Last live verification by check-sources, e.g. "2026-10-26 run 40317228309". */
  verified?: string;
  credentials?: string[];
  origin?: string;
  notes?: string;
}

export const REGISTRY_PATH = join(import.meta.dirname, '..', '..', '..', 'sources', 'registry.json');

export function loadRegistry(path = REGISTRY_PATH): SourceConfig[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { sources: SourceConfig[] };
  const seen = new Set<string>();
  for (const s of raw.sources) {
    if (!/^[a-z0-9-]+$/.test(s.key)) throw new Error(`bad source key: ${s.key}`);
    if (seen.has(s.key)) throw new Error(`duplicate source key: ${s.key}`);
    seen.add(s.key);
    if (s.kind !== 'rss' && s.kind !== 'naver') throw new Error(`${s.key}: unknown kind ${s.kind}`);
    if (!/^https:\/\//.test(s.url)) throw new Error(`${s.key}: url must be https`);
    if (![1, 2, 3].includes(s.reliabilityTier)) throw new Error(`${s.key}: reliabilityTier must be 1–3`);
  }
  return raw.sources;
}
