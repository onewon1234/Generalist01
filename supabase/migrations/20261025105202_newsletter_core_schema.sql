create table public.sources (
  id               bigint generated always as identity primary key,
  name             text not null unique,
  category         text not null check (category in (
                     'korea_world','economy_business','technology_ai',
                     'knowledge_science_history','humanities')),
  source_type      text not null check (source_type in ('naver_api','rss','api','manual')),
  base_url         text not null,
  feed_url         text,
  language         text not null default 'ko',
  reliability_tier smallint not null default 2 check (reliability_tier between 1 and 3),
  allows_fulltext  boolean not null default false,
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now()
);

create table public.articles (
  id                bigint generated always as identity primary key,
  source_id         bigint references public.sources(id) on delete set null,
  url               text not null unique,
  canonical_url     text,
  title             text not null,
  author            text,
  language          text not null default 'ko',
  category          text check (category in (
                      'korea_world','economy_business','technology_ai',
                      'knowledge_science_history','humanities')),
  excerpt           text check (char_length(excerpt) <= 1000),
  event_date        date,
  published_at      timestamptz,
  source_updated_at timestamptz,
  retrieved_at      timestamptz not null default now(),
  url_status        text not null default 'unchecked'
                      check (url_status in ('unchecked','ok','broken','paywalled')),
  url_checked_at    timestamptz,
  content_hash      text
);
create index articles_source_id_idx    on public.articles (source_id);
create index articles_published_at_idx on public.articles (published_at desc);
create index articles_category_pub_idx on public.articles (category, published_at desc);

create table public.story_clusters (
  id                 bigint generated always as identity primary key,
  title              text not null,
  category           text not null check (category in (
                       'korea_world','economy_business','technology_ai',
                       'knowledge_science_history','humanities')),
  event_date         date,
  primary_article_id bigint references public.articles(id) on delete set null,
  status             text not null default 'candidate'
                       check (status in ('candidate','selected','rejected','published')),
  first_seen_at      timestamptz not null default now()
);
create index story_clusters_primary_article_idx on public.story_clusters (primary_article_id);
create index story_clusters_status_idx          on public.story_clusters (status, first_seen_at desc);

create table public.cluster_articles (
  cluster_id bigint not null references public.story_clusters(id) on delete cascade,
  article_id bigint not null references public.articles(id) on delete cascade,
  role       text not null default 'supporting' check (role in ('primary','supporting')),
  primary key (cluster_id, article_id)
);
create index cluster_articles_article_idx on public.cluster_articles (article_id);

create table public.ai_summaries (
  id             bigint generated always as identity primary key,
  cluster_id     bigint not null references public.story_clusters(id) on delete cascade,
  background     text not null,
  key_facts      text not null,
  significance   text not null,
  uncertainties  text,
  model          text not null,
  prompt_version text,
  created_at     timestamptz not null default now()
);
create index ai_summaries_cluster_idx on public.ai_summaries (cluster_id);

create table public.glossary_terms (
  id               bigint generated always as identity primary key,
  term             text not null,
  language         text not null default 'ko',
  short_definition text,
  explanation_url  text not null,
  source_name      text,
  link_status      text not null default 'unchecked'
                     check (link_status in ('unchecked','ok','broken')),
  last_verified_at timestamptz,
  created_at       timestamptz not null default now()
);
create unique index glossary_terms_term_lang_uq on public.glossary_terms (lower(term), language);

create table public.issues (
  id              bigint generated always as identity primary key,
  issue_date      date not null unique,
  status          text not null default 'draft'
                    check (status in ('draft','approved','sent','failed')),
  subject         text,
  html_body       text,
  recipient_count integer not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table public.issue_items (
  id                  bigint generated always as identity primary key,
  issue_id            bigint not null references public.issues(id) on delete cascade,
  cluster_id          bigint references public.story_clusters(id) on delete set null,
  summary_id          bigint references public.ai_summaries(id) on delete set null,
  category            text not null check (category in (
                        'korea_world','economy_business','technology_ai',
                        'knowledge_science_history','humanities')),
  position            smallint not null,
  deeper_resource_url text,
  unique (issue_id, position)
);
create index issue_items_cluster_idx on public.issue_items (cluster_id);
create index issue_items_summary_idx on public.issue_items (summary_id);

create table public.item_terms (
  issue_item_id bigint not null references public.issue_items(id) on delete cascade,
  term_id       bigint not null references public.glossary_terms(id) on delete cascade,
  primary key (issue_item_id, term_id)
);
create index item_terms_term_idx on public.item_terms (term_id);

create table public.editorial_log (
  id         bigint generated always as identity primary key,
  issue_id   bigint references public.issues(id) on delete set null,
  cluster_id bigint references public.story_clusters(id) on delete set null,
  article_id bigint references public.articles(id) on delete set null,
  stage      text not null check (stage in (
               'news_scout','knowledge_scout','research_analyst',
               'content_writer','fact_checker','editor_in_chief')),
  decision   text not null check (decision in ('selected','rejected','flagged','approved','revised')),
  reason     text,
  created_at timestamptz not null default now()
);
create index editorial_log_issue_idx   on public.editorial_log (issue_id);
create index editorial_log_cluster_idx on public.editorial_log (cluster_id);
create index editorial_log_article_idx on public.editorial_log (article_id);

alter table public.sources          enable row level security;
alter table public.articles         enable row level security;
alter table public.story_clusters   enable row level security;
alter table public.cluster_articles enable row level security;
alter table public.ai_summaries     enable row level security;
alter table public.glossary_terms   enable row level security;
alter table public.issues           enable row level security;
alter table public.issue_items      enable row level security;
alter table public.item_terms       enable row level security;
alter table public.editorial_log    enable row level security;
