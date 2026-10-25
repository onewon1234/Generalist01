/**
 * Applies the real migration files to an in-process Postgres (PGlite), loads
 * sample rows shaped like production, rolls everything back and re-applies.
 * Never touches the Supabase project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = join(import.meta.dirname, '..', '..', 'supabase');
const migrations = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const rollbacks = (m: string) => join(ROOT, 'rollbacks', m.replace(/\.sql$/, '.down.sql'));

async function tables(db: PGlite): Promise<string[]> {
  const r = await db.query<{ t: string }>(`select table_name as t from information_schema.tables where table_schema='public' order by 1`);
  return r.rows.map((x) => x.t);
}

async function applyAll(db: PGlite) {
  for (const m of migrations) await db.exec(readFileSync(join(ROOT, 'migrations', m), 'utf8'));
}

test('every migration has a rollback file', () => {
  assert.ok(migrations.length >= 3);
  for (const m of migrations) assert.doesNotThrow(() => readFileSync(rollbacks(m)), `missing rollback for ${m}`);
});

test('migrations apply, roll back cleanly with data, and re-apply', async () => {
  const db = new PGlite();
  // migration 1 alone, with email-era data, then the rest (exercises the category remap)
  await db.exec(readFileSync(join(ROOT, 'migrations', migrations[0]), 'utf8'));
  await db.exec(`insert into public.sources (name, category, source_type, base_url) values ('S', 'technology_ai', 'rss', 'https://s.example');`);
  for (const m of migrations.slice(1)) await db.exec(readFileSync(join(ROOT, 'migrations', m), 'utf8'));

  const cat = await db.query<{ category: string }>(`select category from public.sources`);
  assert.equal(cat.rows[0].category, 'science-technology-ai');
  const all = await tables(db);
  for (const t of ['subjects', 'issues', 'issue_items', 'reference_sources', 'reference_items', 'pipeline_runs', 'edition_freshness', 'coverage_7d'])
    assert.ok(all.includes(t), `missing ${t}`);

  // production-shaped rows
  await db.exec(`
    insert into public.issues (issue_date, status, edition_number) values ('2026-10-25', 'in_review', 1);
    insert into public.issue_items (issue_id, category, position, slug, title, freshness_type, source_age_hours)
      select id, 'language', 1, 'x', 'X', 'timely', 12 from public.issues;
    insert into public.reference_sources (key, name, type, lang, access) values ('quanta', 'Quanta', 'magazine', 'en', 'accessible');
    insert into public.reference_items (source_key, title, url, date_precision, format, lang)
      values ('quanta', 'T', 'https://q.example/t', 'day', 'feature_explainer', 'en');`);
  const fr = await db.query<{ timely: number }>(`select timely::int from public.edition_freshness`);
  assert.equal(fr.rows[0].timely, 1);

  for (const m of [...migrations].reverse()) await db.exec(readFileSync(rollbacks(m), 'utf8'));
  assert.deepEqual(await tables(db), [], 'rollback leaves no public tables');

  await applyAll(db);
  assert.ok((await tables(db)).includes('reference_items'), 're-apply after rollback');
  await db.close();
});

test('rolling back only the latest migration keeps earlier data', async () => {
  const db = new PGlite();
  await applyAll(db);
  await db.exec(`insert into public.issues (issue_date, status, edition_number) values ('2026-10-25', 'in_review', 1);`);
  await db.exec(readFileSync(rollbacks(migrations.at(-1)!), 'utf8'));
  const r = await db.query<{ status: string }>(`select status from public.issues`);
  assert.equal(r.rows[0].status, 'in_review');
  assert.ok(!(await tables(db)).includes('reference_items'));
  await db.close();
});
