-- =====================================================================
-- STORAGE FOTO & JADWAL PENGINGAT
-- Struktur path foto: <user_id>/<ref_type>/<ref_id>/<uuid>.jpg
-- =====================================================================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "att upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.is_staff());

create policy "att read by role" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (
    public.is_office()
    or (storage.foldername(name))[1] = auth.uid()::text
    or (public.is_warehouse() and (storage.foldername(name))[2] in
        ('purchase','goods_receipt','dispatch','factory_receipt','production','opname','adjustment'))));

create policy "att delete own pending" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_office()));

-- Pengingat setiap hari jam 07.00 WIB (00.00 UTC).
-- Aktifkan extension pg_cron di Dashboard > Database > Extensions sebelum menjalankan bagian ini.
create extension if not exists pg_cron;
select cron.schedule('kopra-reminders', '0 0 * * *', $$select public.generate_reminders();$$);
