create table public.subjects (
  slug        text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ko     text not null,
  name_en     text not null,
  parent_slug text references public.subjects(slug) on delete set null,
  is_broad    boolean not null default false,
  sort_order  smallint not null default 100,
  created_at  timestamptz not null default now()
);
create index subjects_parent_idx on public.subjects (parent_slug);
alter table public.subjects enable row level security;

insert into public.subjects (slug, name_ko, name_en, is_broad, sort_order) values
  ('world-politics-society',            '세계·정치·사회',        'World, Politics & Society', true, 10),
  ('economics-finance-business',        '경제·금융·비즈니스',    'Economics, Finance & Business', true, 20),
  ('science-technology-ai',             '과학·기술·AI',          'Science, Technology & AI', true, 30),
  ('history-civilization-geography',    '역사·문명·지리',        'History, Civilization & Geography', true, 40),
  ('philosophy-literature-arts-culture','철학·문학·예술·문화',   'Philosophy, Literature, Arts & Culture', true, 50),
  ('psychology-behavior-everyday',      '심리·행동·일상',        'Psychology, Human Behavior & Everyday Life', true, 60);
insert into public.subjects (slug, name_ko, name_en, parent_slug, sort_order) values
  ('mathematics',         '수학',        'Mathematics',          'science-technology-ai', 110),
  ('environment',         '환경',        'Environment',          'science-technology-ai', 120),
  ('medicine',            '의학',        'Medicine',             'science-technology-ai', 130),
  ('architecture-design', '건축·디자인', 'Architecture & Design','philosophy-literature-arts-culture', 140),
  ('law',                 '법',          'Law',                  'world-politics-society', 150),
  ('language',            '언어',        'Language',             'philosophy-literature-arts-culture', 160),
  ('anthropology',        '인류학',      'Anthropology',         'history-civilization-geography', 170);

alter table public.sources        drop constraint sources_category_check;
alter table public.articles       drop constraint articles_category_check;
alter table public.story_clusters drop constraint story_clusters_category_check;
alter table public.issue_items    drop constraint issue_items_category_check;

do $$
declare t text;
begin
  foreach t in array array['sources','articles','story_clusters','issue_items'] loop
    execute format($f$update public.%I set category = case category
      when 'korea_world' then 'world-politics-society'
      when 'economy_business' then 'economics-finance-business'
      when 'technology_ai' then 'science-technology-ai'
      when 'knowledge_science_history' then 'history-civilization-geography'
      when 'humanities' then 'philosophy-literature-arts-culture'
      else category end$f$, t);
  end loop;
end $$;

alter table public.sources        add constraint sources_category_fkey        foreign key (category) references public.subjects(slug);
alter table public.articles       add constraint articles_category_fkey       foreign key (category) references public.subjects(slug);
alter table public.story_clusters add constraint story_clusters_category_fkey foreign key (category) references public.subjects(slug);
alter table public.issue_items    add constraint issue_items_category_fkey    foreign key (category) references public.subjects(slug);
create index sources_category_idx        on public.sources (category);
create index story_clusters_category_idx on public.story_clusters (category);
create index issue_items_category_idx    on public.issue_items (category);

alter table public.story_clusters
  add column freshness_type      text not null default 'timely' check (freshness_type in ('timely','evergreen')),
  add column is_major            boolean not null default false,
  add column subtopic            text,
  add column topic_key           text,
  add column functions           text[] not null default '{}',
  add column scores              jsonb,
  add column suitability         numeric(5,2),
  add column last_development_at timestamptz;
alter table public.story_clusters drop constraint story_clusters_status_check;
alter table public.story_clusters add constraint story_clusters_status_check
  check (status in ('backlog','candidate','selected','rejected','published'));
alter table public.story_clusters add constraint story_clusters_functions_check
  check (functions <@ array['must_know','in_the_know','essentials','good_to_know','something_new','food_for_thought']::text[]);
create index story_clusters_topic_key_idx on public.story_clusters (topic_key);

alter table public.issues
  add column edition_number        integer unique,
  add column intro                 text,
  add column total_reading_minutes smallint,
  add column approved_at           timestamptz,
  add column published_at          timestamptz;
alter table public.issues drop constraint issues_status_check;
alter table public.issues add constraint issues_status_check
  check (status in ('draft','in_review','approved','published','failed','withdrawn','sent'));
create index issues_status_date_idx on public.issues (status, issue_date desc);

alter table public.issue_items
  add column slug              text,
  add column title             text,
  add column subtitle          text,
  add column body_md           text,
  add column subtopic          text,
  add column functions         text[] not null default '{}',
  add column freshness_type    text not null default 'timely' check (freshness_type in ('timely','evergreen')),
  add column event_date        date,
  add column card_size         text not null default 'small' check (card_size in ('large','medium','small')),
  add column is_featured       boolean not null default false,
  add column reading_minutes   smallint,
  add column fact_check_status text not null default 'pending' check (fact_check_status in ('pending','passed','flagged','failed')),
  add column fact_check_notes  text;
alter table public.issue_items add constraint issue_items_functions_check
  check (functions <@ array['must_know','in_the_know','essentials','good_to_know','something_new','food_for_thought']::text[]);
alter table public.issue_items add constraint issue_items_issue_slug_key unique (issue_id, slug);

create table public.item_sources (
  id            bigint generated always as identity primary key,
  issue_item_id bigint not null references public.issue_items(id) on delete cascade,
  article_id    bigint references public.articles(id) on delete set null,
  role          text not null check (role in ('primary','supporting','further_reading')),
  url           text not null,
  title         text not null,
  publisher     text,
  language      text not null default 'ko',
  position      smallint not null default 1,
  last_check_ok boolean,
  verified_at   timestamptz
);
create index item_sources_item_idx    on public.item_sources (issue_item_id);
create index item_sources_article_idx on public.item_sources (article_id);
alter table public.item_sources enable row level security;

create table public.link_checks (
  id          bigint generated always as identity primary key,
  url         text not null,
  checked_at  timestamptz not null default now(),
  http_status smallint,
  final_url   text,
  ok          boolean not null,
  error       text
);
create index link_checks_url_idx on public.link_checks (url, checked_at desc);
alter table public.link_checks enable row level security;

create table public.pipeline_runs (
  id          bigint generated always as identity primary key,
  run_date    date not null default (now() at time zone 'Asia/Seoul')::date,
  stage       text not null,
  status      text not null default 'running' check (status in ('running','succeeded','failed','skipped')),
  issue_id    bigint references public.issues(id) on delete set null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  stats       jsonb,
  error       text
);
create index pipeline_runs_date_idx  on public.pipeline_runs (run_date desc, stage);
create index pipeline_runs_issue_idx on public.pipeline_runs (issue_id);
alter table public.pipeline_runs enable row level security;

create view public.coverage_7d with (security_invoker = true) as
select ii.category, ii.subtopic, count(*) as stories, max(i.issue_date) as last_seen
from public.issue_items ii join public.issues i on i.id = ii.issue_id
where i.status = 'published' and i.issue_date >= (now() at time zone 'Asia/Seoul')::date - 7
group by ii.category, ii.subtopic;

create view public.coverage_30d with (security_invoker = true) as
select ii.category, ii.subtopic, count(*) as stories, max(i.issue_date) as last_seen
from public.issue_items ii join public.issues i on i.id = ii.issue_id
where i.status = 'published' and i.issue_date >= (now() at time zone 'Asia/Seoul')::date - 30
group by ii.category, ii.subtopic;
