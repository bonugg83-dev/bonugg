-- Original uploaded PDFs, kept for provenance / fallback viewing.
create table source_pdfs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  page_count int,
  uploaded_at timestamptz not null default now()
);

-- One row per problem crop that had a handwritten (non-black ink) concept note.
-- This is the only content unit in the app: problem + solution + concept live
-- together in crop_image_path, and `text` is the transcribed/polished concept.
create table concepts (
  id uuid primary key default gen_random_uuid(),
  source_pdf_id uuid references source_pdfs(id) on delete set null,
  page_number int not null,
  subject_id text not null,
  crop_image_path text not null,
  crop_bounds jsonb not null,
  raw_text text,
  text text not null,
  ease_factor real not null default 2.5,
  interval_days int not null default 1,
  next_review_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

create index concepts_next_review_date_idx on concepts (next_review_date);
create index concepts_text_search_idx on concepts using gin (to_tsvector('simple', text));

-- No RLS policies are defined: all app access goes through Next.js API
-- routes using the service role key (which bypasses RLS), never the anon
-- key, so enabling RLS with zero policies denies the anon key entirely.
alter table source_pdfs enable row level security;
alter table concepts enable row level security;

insert into storage.buckets (id, name, public)
values ('source-pdfs', 'source-pdfs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('concept-crops', 'concept-crops', false)
on conflict (id) do nothing;
