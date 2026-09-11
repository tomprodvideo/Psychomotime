-- ============================================================
--  PSYCHOMOTIME — Migration 008 : Documents (dossiers + fichiers)
--  À coller dans : Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- Dossiers ----------
create table if not exists public.doc_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Nouveau dossier',
  created_at timestamptz not null default now()
);
alter table public.doc_folders enable row level security;
drop policy if exists "own folders" on public.doc_folders;
create policy "own folders" on public.doc_folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Documents (métadonnées) ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder_id uuid references public.doc_folders(id) on delete set null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size bigint,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_documents_user on public.documents(user_id);
create index if not exists idx_doc_folders_user on public.doc_folders(user_id);

-- ---------- Bucket de stockage (privé, 10 Mo max/fichier) ----------
insert into storage.buckets (id, name, public, file_size_limit)
  values ('documents', 'documents', false, 10485760)
  on conflict (id) do update set file_size_limit = 10485760;

-- ---------- Sécurité du stockage : chacun gère uniquement ses fichiers ----------
-- (chemin des fichiers : <user_id>/<fichier>)
drop policy if exists "doc read own" on storage.objects;
create policy "doc read own" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "doc insert own" on storage.objects;
create policy "doc insert own" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "doc delete own" on storage.objects;
create policy "doc delete own" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
