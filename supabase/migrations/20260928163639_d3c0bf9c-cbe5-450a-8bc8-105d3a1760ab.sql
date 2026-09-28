CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_key text NOT NULL UNIQUE,
  official_url text NOT NULL,
  title text,
  source_class text NOT NULL CHECK (source_class IN ('ecfr','fr_final','fr_proposed','fr_notice','fsa_handbook','dcl','electronic_announcement','technical_reference','other')),
  source_status text NOT NULL DEFAULT 'in_force' CHECK (source_status IN ('in_force','proposed','superseded','withdrawn','informational')),
  publication_date date,
  effective_date date,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content_hash text NOT NULL,
  award_year text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  heading text,
  text text NOT NULL,
  citation_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, ordinal)
);
CREATE INDEX chunks_citation_ref_idx ON public.chunks(citation_ref);
GRANT ALL ON public.chunks TO service_role;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.documents, public.chunks FROM anon, authenticated;