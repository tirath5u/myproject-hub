create table if not exists public.ed_usage_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('lookup','explain','compare')),
  ok boolean not null,
  mode text,
  refused boolean not null default false,
  capped boolean not null default false,
  check_failed boolean not null default false,
  staged boolean not null default false,
  latency_ms integer,
  embedding_tokens integer,
  ai_tokens integer,
  question text
);
create index if not exists ed_usage_log_created_at on public.ed_usage_log (created_at desc);
create index if not exists ed_usage_log_kind_created_at on public.ed_usage_log (kind, created_at desc);

create table if not exists public.ed_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  helpful boolean not null,
  lookup_mode text,
  citation_id text,
  question text,
  comment text check (comment is null or length(comment) <= 500)
);
create index if not exists ed_feedback_created_at on public.ed_feedback (created_at desc);

alter table public.ed_usage_log enable row level security;
alter table public.ed_feedback enable row level security;
revoke all on public.ed_usage_log, public.ed_feedback from public, anon, authenticated;
grant select, insert on public.ed_usage_log, public.ed_feedback to service_role;
grant usage on all sequences in schema public to service_role;