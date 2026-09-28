CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
ALTER TABLE public.chunks ADD COLUMN embedding extensions.vector(3072);
ALTER TABLE public.chunks ADD COLUMN embedding_model text;