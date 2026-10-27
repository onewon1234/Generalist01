/**
 * Tests the PENDING (not applied) migration on an in-process Postgres:
 * the pipeline role can write drafts and retrieval records, cannot delete,
 * cannot publish, and unread retrievals cannot carry evidence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const ROOT = join(import.meta.dirname, '..', '..', 'supabase');
const NAME = '20261028090000_pipeline_writer_and_retrievals';

async function db() {
  const d = new PGlite();
  // Supabase roles referenced by policies elsewhere do not exist in plain Postgres; create stand-ins.
  await d.exec(`do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;`);
  for (const m of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort())
    await d.exec(readFileSync(join(ROOT, 'migrations', m), 'utf8'));
  await d.exec(readFileSync(join(ROOT, 'pending', `${NAME}.sql`), 'utf8'));
  // PGlite runs as a superuser that bypasses RLS; a non-superuser test role makes policies apply.
  await d.exec(`create role tester nologin; grant pipeline_writer to tester;`);
  return d;
}

const asWriter = async (d: PGlite, sql: string) => {
  await d.exec('set role pipeline_writer');
  try { return await d.exec(sql); } finally { await d.exec('reset role'); }
};

test('pending migration: writer can insert drafts and read-only evidence records', async () => {
  const d = await db();
  await asWriter(d, `insert into public.issues (issue_date, status, edition_number) values ('2026-10-28', 'in_review', 2);`);
  await asWriter(d, `insert into public.retrievals (url, publisher, status, robots, retrieved_at, text_chars, evidence)
    values ('https://yna.example/a', '연합뉴스', 'read', 'allowed', now(), 1200, '[{"kind":"lede","text":"…","paragraph":0,"figures":[]}]');`);
  const r = await d.query<{ n: number }>(`select count(*)::int n from public.retrievals`);
  assert.equal(r.rows[0].n, 1);
  await d.close();
});

test('pending migration: writer cannot delete, publish, or attach evidence to unread articles', async () => {
  const d = await db();
  await asWriter(d, `insert into public.issues (issue_date, status, edition_number) values ('2026-10-28', 'in_review', 2);`);
  await assert.rejects(asWriter(d, `delete from public.issues`), /permission denied/);
  await assert.rejects(asWriter(d, `update public.issues set status = 'published'`), /row-level security|policy/);
  await assert.rejects(asWriter(d, `insert into public.issues (issue_date, status) values ('2026-10-29', 'published')`), /row-level security|policy/);
  await assert.rejects(asWriter(d, `insert into public.retrievals (url, publisher, status, robots, retrieved_at, evidence)
    values ('https://x.example', 'X', 'blocked-robots', 'disallowed', now(), '[{"kind":"lede","text":"x","paragraph":0,"figures":[]}]')`), /retrievals_evidence_only_when_read/);
  await assert.rejects(asWriter(d, `drop table public.retrievals`), /must be owner|permission denied/);
  await assert.rejects(asWriter(d, `select * from public.reference_items`), /permission denied/);
  await d.close();
});

test('pending migration rolls back cleanly', async () => {
  const d = await db();
  await d.exec(`drop role tester;`);
  await d.exec(readFileSync(join(ROOT, 'pending', `${NAME}.down.sql`), 'utf8'));
  const t = await d.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name = 'retrievals'`);
  assert.equal(t.rows[0].n, 0);
  const role = await d.query<{ n: number }>(`select count(*)::int n from pg_roles where rolname = 'pipeline_writer'`);
  assert.equal(role.rows[0].n, 0);
  await d.close();
});
