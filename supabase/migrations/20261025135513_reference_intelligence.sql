create table public.reference_sources (
  key        text primary key,
  name       text not null,
  type       text not null,
  lang       text not null,
  home_url   text,
  access     text not null check (access in ('accessible','partial','inaccessible')),
  route      text,
  note       text,
  deep_reads smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reference_sources enable row level security;

create table public.reference_items (
  id                     bigint generated always as identity primary key,
  source_key             text not null references public.reference_sources(key) on delete cascade,
  channel                text,
  title                  text not null,
  url                    text not null unique,
  published              text,
  date_precision         text not null check (date_precision in ('day','month','relative','none')),
  age_days_at_collection integer,
  format                 text not null,
  subject                text,
  headline_devices       text[] not null default '{}',
  lang                   text not null,
  analysis               jsonb,
  collected_at           timestamptz not null default '2026-10-25T13:40:00Z'
);
create index reference_items_source_idx  on public.reference_items (source_key);
create index reference_items_subject_idx on public.reference_items (subject);
alter table public.reference_items enable row level security;

alter table public.issue_items
  add column source_age_hours numeric(6,1),
  add column why_now text,
  add column angle text;

create view public.edition_freshness with (security_invoker = true) as
select i.issue_date, i.edition_number, i.status,
       count(*)                                              as stories,
       count(*) filter (where ii.freshness_type = 'timely')    as timely,
       count(*) filter (where ii.freshness_type = 'evergreen') as evergreen,
       percentile_cont(0.5) within group (order by ii.source_age_hours)
         filter (where ii.freshness_type = 'timely')           as median_timely_source_age_hours,
       max(ii.source_age_hours) filter (where ii.freshness_type = 'timely') as oldest_timely_source_age_hours
from public.issues i join public.issue_items ii on ii.issue_id = i.id
group by i.issue_date, i.edition_number, i.status;
