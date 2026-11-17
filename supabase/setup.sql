-- My Fitness & Futsal – configurazione Supabase (da eseguire UNA volta nel tuo progetto:
-- Supabase → SQL Editor → New query → incolla → Run).
-- Crea un bucket PRIVATO per i backup cifrati e regole RLS: ogni utente può leggere/scrivere
-- solo la propria cartella "<id utente>/". I file sono già cifrati sul telefono.

insert into storage.buckets (id, name, public, file_size_limit)
values ('backups', 'backups', false, 52428800) -- 50 MB per file (limite del piano gratuito)
on conflict (id) do update set public = false;

drop policy if exists "mff_backups_select_own" on storage.objects;
drop policy if exists "mff_backups_insert_own" on storage.objects;
drop policy if exists "mff_backups_update_own" on storage.objects;
drop policy if exists "mff_backups_delete_own" on storage.objects;

create policy "mff_backups_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "mff_backups_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "mff_backups_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "mff_backups_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = (select auth.uid())::text);
