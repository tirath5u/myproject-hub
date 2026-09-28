create or replace function public.match_chunks(query_embedding vector(3072), match_count int default 3)
returns table (id uuid, heading text, text text, citation_ref text, ordinal int, similarity float,
  official_url text, title text, award_year text, source_class text, source_status text,
  publication_date date, last_modified_date date, retrieved_at timestamptz, content_hash text, document_version_key text)
language sql stable set search_path = public, extensions as $$
  select c.id, c.heading, c.text, c.citation_ref, c.ordinal,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.official_url, d.title, d.award_year, d.source_class, d.source_status,
    d.publication_date, d.last_modified_date, d.retrieved_at, d.content_hash, d.document_version_key
  from public.chunks c join public.documents d on d.id = c.document_version_id
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count,1),10);
$$;
revoke all on function public.match_chunks(vector, int) from public, anon, authenticated;
grant execute on function public.match_chunks(vector, int) to service_role;