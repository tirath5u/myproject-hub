-- Stage 2A: staged handbook imports, passage flags, and a v2 lookup.
-- Assumes preview and the published site share this database: rows imported as 'staged'
-- must never reach the published lookup (match_current_chunks, v1) until promoted.

-- 1. New source_status value 'staged'.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_source_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_source_status_check
  CHECK (source_status IN ('in_force','proposed','superseded','withdrawn','informational','staged'));

-- 2. Flag columns. page_published_date is the FSA page's first-published date, never the award-year release date.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS page_published_date date;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS fictional_amounts boolean NOT NULL DEFAULT false;
UPDATE public.chunks SET is_example = true WHERE heading ~ 'Example [0-9]+' AND NOT is_example;

-- 3. v1 (called by the published code): same signature and columns, now excludes staged/superseded/withdrawn rows.
create or replace function public.match_current_chunks(query_embedding extensions.vector, award text, match_count int default 60)
returns table (id uuid, heading text, text text, citation_ref text, ordinal int, similarity double precision, official_url text, title text, award_year text,
  source_class text, source_status text, publication_date date, last_modified_date date, retrieved_at timestamptz, content_hash text, document_version_key text)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.heading, c.text, c.citation_ref, c.ordinal,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.official_url, d.title, d.award_year, d.source_class::text, d.source_status::text,
    d.publication_date, d.last_modified_date, d.retrieved_at, d.content_hash, d.document_version_key
  from public.chunks c join public.documents d on d.id = c.document_version_id
  where c.embedding is not null and d.award_year = award
    and d.source_status not in ('staged','superseded','withdrawn')
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count,1),100);
$$;
revoke all on function public.match_current_chunks(extensions.vector, text, int) from public, anon, authenticated;
grant execute on function public.match_current_chunks(extensions.vector, text, int) to service_role;

-- 4. v2: flag columns + page_published_date, cap 500, staged rows only when asked (preview).
create or replace function public.match_current_chunks_v2(query_embedding extensions.vector, award text, match_count int default 60, include_staged boolean default false)
returns table (id uuid, heading text, text text, citation_ref text, ordinal int, similarity double precision, official_url text, title text, award_year text,
  source_class text, source_status text, publication_date date, last_modified_date date, page_published_date date, retrieved_at timestamptz, content_hash text,
  document_version_key text, is_example boolean, fictional_amounts boolean)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.heading, c.text, c.citation_ref, c.ordinal,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.official_url, d.title, d.award_year, d.source_class::text, d.source_status::text,
    d.publication_date, d.last_modified_date, d.page_published_date, d.retrieved_at, d.content_hash, d.document_version_key,
    c.is_example, c.fictional_amounts
  from public.chunks c join public.documents d on d.id = c.document_version_id
  where c.embedding is not null and d.award_year = award
    and d.source_status not in ('superseded','withdrawn')
    and (include_staged or d.source_status <> 'staged')
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count,1),500);
$$;
revoke all on function public.match_current_chunks_v2(extensions.vector, text, int, boolean) from public, anon, authenticated;
grant execute on function public.match_current_chunks_v2(extensions.vector, text, int, boolean) to service_role;
