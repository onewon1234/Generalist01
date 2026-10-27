/**
 * preview: ingest live sources, research the strongest candidates and write a
 * private editorial preview.
 *   npx tsx src/cli/preview.ts --out-dir <dir>
 * Writes <dir>/preview.md, preview.json and the source-distribution audit (audit.md/json). No AI calls, no database
 * writes, nothing published. Run it where the output stays private (not in
 * the public repository's Actions logs).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { httpFetch } from '../collect/http.ts';
import { loadRegistry } from '../collect/registry.ts';
import { ingest } from '../ingest/ingest.ts';
import { buildPreview } from '../preview/preview.ts';
import { renderPreview } from '../preview/render.ts';
import { renderAudit, sourceAudit } from '../preview/audit.ts';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const outDir = arg('--out-dir');
if (!outDir) { console.error('usage: preview --out-dir <dir>'); process.exit(2); }
if (process.env.GITHUB_ACTIONS && process.env.ALLOW_PUBLIC_PREVIEW !== '1') {
  console.error('refusing to run in GitHub Actions: the repository is public and previews contain unpublished drafts');
  process.exit(2);
}
const registry = loadRegistry();
const subjectOf = new Map(registry.map((s) => [s.key, s.subject]));
const t0 = Date.now();
const res = await ingest(registry, httpFetch, new Date());
const preview = await buildPreview(res, httpFetch, (a) => subjectOf.get(a.sourceKey ?? '') ?? 'world-politics-society', {
  poolSize: Number(arg('--pool') ?? 24), perStory: Number(arg('--per-story') ?? 3),
});
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'preview.json'), JSON.stringify(preview, null, 2));
writeFileSync(join(outDir, 'preview.md'), renderPreview(preview));
const audit = sourceAudit(res, preview, registry);
writeFileSync(join(outDir, 'audit.json'), JSON.stringify(audit, null, 2));
writeFileSync(join(outDir, 'audit.md'), renderAudit(audit));
const sel = preview.stories.filter((s) => s.selected);
console.log(`preview: ${sel.length} selected of ${preview.pool} researched; ${preview.fetches} article requests; ${Math.round((Date.now() - t0) / 1000)}s → ${outDir}`);
