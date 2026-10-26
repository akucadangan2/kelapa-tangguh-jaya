-- =====================================================================
-- ALUR MODAL PETUGAS, PERTANGGUNGJAWABAN, VERIFIKASI, PENGINGAT
-- Dipanggil dari website dan aplikasi lewat supabase.rpc(...)
-- =====================================================================

create or replace function public.field_account_of(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from cash_accounts where type = 'field' and owner_id = p_user limit 1;
$$;

create or replace function public.cash_balance(p_account uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case direction when 'in' then amount else -amount end), 0)
  from cash_transactions where account_id = p_account;
$$;

-- ---------------------------------------------------------------------
-- Ringkasan penggunaan modal satu penugasan
-- ---------------------------------------------------------------------
create or replace function public.assignment_summary(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.assignments; v_acc uuid;
  v_disb numeric; v_paid numeric; v_adv numeric; v_adv_ret numeric; v_exp numeric; v_ret numeric;
  v_used numeric; v_received numeric; v_products jsonb; v_expense_cat jsonb; v_purch_total numeric; v_unpaid numeric;
begin
  select * into a from assignments where id = p_id;
  if a.id is null then return null; end if;
  if not (is_office() or a.user_id = auth.uid() or is_system()) then raise exception 'Tidak berwenang'; end if;
  v_acc := field_account_of(a.user_id);

  select coalesce(sum(amount), 0) into v_disb from cash_transfers where assignment_id = p_id and type = 'disbursement';
  select coalesce(sum(amount), 0) into v_ret  from cash_transfers where assignment_id = p_id and type = 'return';
  select coalesce(sum(pp.amount), 0) into v_paid
    from purchase_payments pp join purchases p on p.id = pp.purchase_id
    where p.assignment_id = p_id and pp.cash_account_id = v_acc and p.status <> 'cancelled';
  select coalesce(sum(amount), 0) into v_adv from advances
    where assignment_id = p_id and cash_account_id = v_acc and status <> 'cancelled';
  select coalesce(sum(ar.amount), 0) into v_adv_ret
    from advance_returns ar join advances ad on ad.id = ar.advance_id
    where ad.assignment_id = p_id and ar.cash_account_id = v_acc;
  select coalesce(sum(amount), 0) into v_exp from expenses
    where assignment_id = p_id and cash_account_id = v_acc and status <> 'cancelled';
  select coalesce(sum(total_amount), 0), coalesce(sum(balance_due), 0) into v_purch_total, v_unpaid
    from purchases where assignment_id = p_id and status <> 'cancelled';

  select coalesce(jsonb_agg(x), '[]') into v_products from (
    select pr.name as product, sum(p.agreed_kg) as kg, sum(p.total_amount) as total, sum(p.paid_amount) as paid
    from purchases p join products pr on pr.id = p.product_id
    where p.assignment_id = p_id and p.status <> 'cancelled' group by pr.name order by pr.name) x;
  select coalesce(jsonb_agg(x), '[]') into v_expense_cat from (
    select c.name as category, sum(e.amount) as total
    from expenses e join expense_categories c on c.id = e.category_id
    where e.assignment_id = p_id and e.status <> 'cancelled' group by c.name order by c.name) x;

  v_received := a.carry_over_amount + v_disb;
  v_used := v_paid + v_adv + v_exp - v_adv_ret;
  return jsonb_build_object(
    'carry_over', a.carry_over_amount, 'disbursed', v_disb, 'received', v_received,
    'purchase_paid', v_paid, 'advances', v_adv, 'advance_returned', v_adv_ret, 'expenses', v_exp,
    'used', v_used, 'returned', v_ret, 'remaining', v_received - v_used - v_ret,
    'purchase_total', v_purch_total, 'purchase_unpaid', v_unpaid,
    'by_product', v_products, 'by_expense', v_expense_cat,
    'open_advances', (select count(*) from advances where assignment_id = p_id and status = 'open'),
    'in_transit', (select count(*) from purchases where assignment_id = p_id and goods_status <> 'received' and status <> 'cancelled'));
end $$;

-- ---------------------------------------------------------------------
-- Bukti yang belum lengkap / ditolak dalam satu penugasan
-- ---------------------------------------------------------------------
create or replace function public.assignment_missing_proofs(p_id uuid)
returns table(ref_type text, ref_id uuid, ref_no text, problem text)
language sql stable security definer set search_path = public as $$
  with req as (
    select 'purchase'::text rt, p.id, p.no, k.kind
    from purchases p cross join (values ('goods'),('scale'),('receipt')) k(kind)
    where p.assignment_id = p_id and p.status <> 'cancelled'
    union all
    select 'expense', e.id, e.no, 'receipt' from expenses e where e.assignment_id = p_id and e.status <> 'cancelled'
    union all
    select 'advance', a.id, a.no, 'receipt' from advances a where a.assignment_id = p_id and a.status <> 'cancelled')
  select r.rt, r.id, r.no, 'Foto ' || case r.kind when 'goods' then 'barang' when 'scale' then 'timbangan' else 'bukti/nota' end || ' belum ada'
  from req r
  where not exists (select 1 from attachments at where at.ref_type = r.rt and at.ref_id = r.id and at.kind = r.kind and at.verify_status <> 'rejected')
  union all
  select at.ref_type, at.ref_id, coalesce(p.no, e.no, ad.no), 'Bukti ditolak: ' || coalesce(at.note, at.kind)
  from attachments at
  left join purchases p on at.ref_type = 'purchase' and p.id = at.ref_id
  left join expenses e on at.ref_type = 'expense' and e.id = at.ref_id
  left join advances ad on at.ref_type = 'advance' and ad.id = at.ref_id
  where at.verify_status = 'rejected' and coalesce(p.assignment_id, e.assignment_id, ad.assignment_id) = p_id
  union all
  select 'purchase', p.id, p.no, 'Barang belum dikonfirmasi gudang'
  from purchases p where p.assignment_id = p_id and p.status <> 'cancelled' and p.goods_status <> 'received'
  union all
  select 'expense', e.id, e.no, 'Pengeluaran ditolak keuangan'
  from expenses e where e.assignment_id = p_id and e.status = 'rejected';
$$;

-- ---------------------------------------------------------------------
-- Kunci pengajuan modal baru
-- ---------------------------------------------------------------------
create or replace function public.can_request_capital(p_user uuid default auth.uid()) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_reasons text[] := '{}'; r record; v_exc public.assignment_exceptions; v_acc uuid; v_bal numeric := 0;
  v_last public.accountabilities; v_days int := setting_num('transit_days', 3)::int; v_carry numeric := 0; v_open int;
begin
  if not (is_office() or p_user = auth.uid()) then raise exception 'Tidak berwenang'; end if;
  for r in select no, status from assignments
           where user_id = p_user and status in ('submitted','approved','disbursed','active','lpj_submitted','lpj_returned') loop
    v_reasons := v_reasons || ('Penugasan ' || r.no || ' belum selesai (' ||
      case r.status when 'submitted' then 'menunggu persetujuan' when 'approved' then 'menunggu pencairan'
                    when 'disbursed' then 'dana belum dikonfirmasi diterima' when 'active' then 'pertanggungjawaban belum dikirim'
                    when 'lpj_submitted' then 'pertanggungjawaban sedang diperiksa' else 'pertanggungjawaban perlu diperbaiki' end || ')');
  end loop;
  select count(*) into v_open from purchases
    where user_id = p_user and status <> 'cancelled' and goods_status <> 'received' and purchase_date < current_date - v_days;
  if v_open > 0 then v_reasons := v_reasons || (v_open || ' pembelian belum dikonfirmasi gudang lebih dari ' || v_days || ' hari'); end if;

  v_acc := field_account_of(p_user);
  if v_acc is not null and not exists (select 1 from assignments where user_id = p_user
        and status in ('submitted','approved','disbursed','active','lpj_submitted','lpj_returned')) then
    v_bal := cash_balance(v_acc);
    select ac.* into v_last from accountabilities ac join assignments a on a.id = ac.assignment_id
      where a.user_id = p_user and ac.status = 'approved' order by ac.reviewed_at desc nulls last limit 1;
    if v_bal > 0 then
      if v_last.id is not null and v_last.remaining_action = 'return' then
        v_reasons := v_reasons || ('Sisa kas Rp' || to_char(v_bal, 'FM999G999G999G990') || ' belum disetor kembali');
      else
        v_carry := v_bal;
      end if;
    elsif v_bal < 0 then
      v_reasons := v_reasons || ('Saldo kas petugas minus Rp' || to_char(abs(v_bal), 'FM999G999G999G990') || ', perlu dicek keuangan');
    end if;
  end if;

  select * into v_exc from assignment_exceptions
    where user_id = p_user and used_at is null and due_date >= current_date order by created_at desc limit 1;

  return jsonb_build_object(
    'allowed', cardinality(v_reasons) = 0 or v_exc.id is not null,
    'reasons', to_jsonb(v_reasons),
    'exception_id', v_exc.id, 'exception_max', v_exc.max_amount, 'exception_reason', v_exc.reason,
    'carry_over', v_carry, 'cash_balance', v_bal);
end $$;

create or replace function public.tg_assignment_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  c := can_request_capital(new.user_id);
  if not (c->>'allowed')::boolean then
    raise exception 'Pengajuan modal terkunci: %', array_to_string(array(select jsonb_array_elements_text(c->'reasons')), '; ');
  end if;
  if jsonb_array_length(c->'reasons') > 0 and c->>'exception_id' is not null then
    if new.requested_amount > (c->>'exception_max')::numeric then
      raise exception 'Pengajuan melebihi batas pengecualian Rp%', c->>'exception_max';
    end if;
    new.exception_id := (c->>'exception_id')::uuid;
    update assignment_exceptions set used_at = now() where id = new.exception_id;
  end if;
  new.carry_over_amount := coalesce((c->>'carry_over')::numeric, 0);
  new.status := 'submitted';
  return new;
end $$;
create trigger assignment_before_insert before insert on public.assignments
for each row execute function public.tg_assignment_before_insert();

create or replace function public.tg_assignment_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_role(array['owner'], 'Pengajuan modal baru',
    new.no || ' sebesar Rp' || to_char(new.requested_amount, 'FM999G999G999G990'), '/modal/' || new.id, 'asgnew:' || new.id);
  return new;
end $$;
create trigger assignment_after_insert after insert on public.assignments
for each row execute function public.tg_assignment_after_insert();

-- ---------------------------------------------------------------------
-- Persetujuan & pencairan
-- ---------------------------------------------------------------------
create or replace function public.approve_assignment(p_id uuid, p_amount numeric, p_due date, p_items jsonb, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.assignments; i jsonb;
begin
  if not is_owner() then raise exception 'Hanya pemilik yang dapat menyetujui modal'; end if;
  select * into a from assignments where id = p_id for update;
  if a.status <> 'submitted' then raise exception 'Status pengajuan bukan menunggu persetujuan'; end if;
  update assignments set status = 'approved', approved_amount = p_amount, due_date = p_due,
    approved_by = auth.uid(), approved_at = now(), review_note = p_note where id = p_id;
  for i in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    update assignment_items set approved_max_price = (i->>'approved_max_price')::numeric
    where id = (i->>'id')::uuid and assignment_id = p_id;
  end loop;
  perform notify_user(a.user_id, 'Pengajuan modal disetujui', a.no || ' disetujui Rp' || to_char(p_amount, 'FM999G999G999G990'), null, 'asgok:' || p_id);
  perform notify_role(array['finance'], 'Modal siap dicairkan', a.no, '/modal/' || p_id, 'asgdisb:' || p_id);
end $$;

create or replace function public.reject_assignment(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.assignments;
begin
  if not is_owner() then raise exception 'Hanya pemilik yang dapat menolak modal'; end if;
  update assignments set status = 'rejected', review_note = p_note, approved_by = auth.uid(), approved_at = now()
  where id = p_id and status = 'submitted' returning * into a;
  if a.id is null then raise exception 'Pengajuan tidak dalam status menunggu'; end if;
  perform notify_user(a.user_id, 'Pengajuan modal ditolak', a.no || ': ' || coalesce(p_note, ''), null, 'asgno:' || p_id);
end $$;

create or replace function public.disburse_assignment(p_id uuid, p_from uuid, p_amount numeric, p_date date, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.assignments; v_acc uuid; v_trf uuid;
begin
  if not is_office() then raise exception 'Tidak berwenang'; end if;
  select * into a from assignments where id = p_id for update;
  if a.status <> 'approved' then raise exception 'Pengajuan belum disetujui'; end if;
  v_acc := field_account_of(a.user_id);
  if v_acc is null then raise exception 'Petugas belum memiliki kas petugas'; end if;
  insert into cash_transfers(type, from_account_id, to_account_id, amount, transfer_date, assignment_id, note)
  values ('disbursement', p_from, v_acc, p_amount, p_date, p_id, p_note) returning id into v_trf;
  update assignments set status = 'disbursed' where id = p_id;
  perform notify_user(a.user_id, 'Dana modal dicairkan',
    a.no || ': Rp' || to_char(p_amount, 'FM999G999G999G990') || '. Konfirmasi penerimaan di aplikasi.', null, 'asgcair:' || p_id);
  return v_trf;
end $$;

create or replace function public.confirm_assignment_received(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update assignments set status = 'active', received_confirmed_at = now()
  where id = p_id and user_id = auth.uid() and status = 'disbursed';
  if not found then raise exception 'Penugasan tidak dapat dikonfirmasi'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Pertanggungjawaban (LPJ)
-- ---------------------------------------------------------------------
create or replace function public.submit_lpj(p_id uuid, p_cash_reported numeric, p_action text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.assignments; s jsonb; v_rem numeric;
begin
  select * into a from assignments where id = p_id for update;
  if a.user_id <> auth.uid() and not is_office() then raise exception 'Tidak berwenang'; end if;
  if a.status not in ('active','disbursed','lpj_returned') then raise exception 'Penugasan tidak dalam status berjalan'; end if;
  s := assignment_summary(p_id);
  v_rem := (s->>'remaining')::numeric;
  insert into accountabilities(assignment_id, total_received, total_used, total_returned, remaining, cash_reported,
                               cash_diff, remaining_action, note, status, submitted_at)
  values (p_id, (s->>'received')::numeric, (s->>'used')::numeric, (s->>'returned')::numeric, v_rem, p_cash_reported,
          p_cash_reported - v_rem, p_action, p_note, 'submitted', now())
  on conflict (assignment_id) do update set
    total_received = excluded.total_received, total_used = excluded.total_used, total_returned = excluded.total_returned,
    remaining = excluded.remaining, cash_reported = excluded.cash_reported, cash_diff = excluded.cash_diff,
    remaining_action = excluded.remaining_action, note = excluded.note, status = 'submitted', submitted_at = now(),
    reviewed_by = null, reviewed_at = null, review_note = null;
  update assignments set status = 'lpj_submitted' where id = p_id;
  perform notify_role(array['owner','finance'], 'Pertanggungjawaban masuk', a.no || ' menunggu pemeriksaan', '/modal/' || p_id,
                      'lpjin:' || p_id || ':' || extract(epoch from now())::bigint);
  return s;
end $$;

create or replace function public.review_lpj(p_id uuid, p_approve boolean, p_note text, p_force boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare a public.assignments; l public.accountabilities; s jsonb; v_missing int;
begin
  if not is_office() then raise exception 'Tidak berwenang'; end if;
  select * into a from assignments where id = p_id for update;
  select * into l from accountabilities where assignment_id = p_id;
  if a.status <> 'lpj_submitted' then raise exception 'Pertanggungjawaban belum dikirim'; end if;

  if not p_approve then
    update accountabilities set status = 'returned', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = l.id;
    update assignments set status = 'lpj_returned' where id = p_id;
    perform notify_user(a.user_id, 'Pertanggungjawaban dikembalikan', a.no || ': ' || coalesce(p_note, ''), null,
                        'lpjback:' || p_id || ':' || extract(epoch from now())::bigint);
    return;
  end if;

  select count(*) into v_missing from assignment_missing_proofs(p_id);
  if v_missing > 0 and not (p_force and is_owner()) then
    raise exception 'Masih ada % bukti/konfirmasi yang belum lengkap', v_missing;
  end if;
  if l.cash_diff <> 0 and not (p_force and is_owner()) then
    raise exception 'Ada selisih kas Rp%. Selesaikan atau setujui dengan pengecualian pemilik.', l.cash_diff;
  end if;
  s := assignment_summary(p_id);
  if l.remaining_action = 'return' and (s->>'remaining')::numeric > 0.5 then
    raise exception 'Sisa kas Rp% belum dicatat setor kembali', s->>'remaining';
  end if;
  update accountabilities set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note,
    total_returned = (s->>'returned')::numeric, remaining = (s->>'remaining')::numeric where id = l.id;
  update assignments set status = 'closed' where id = p_id;
  perform notify_user(a.user_id, 'Pertanggungjawaban disetujui', a.no || ' selesai. Pengajuan baru sudah bisa dibuat.', null, 'lpjok:' || p_id);
end $$;

-- Pengecualian kunci (hanya pemilik)
create or replace function public.grant_exception(p_user uuid, p_reason text, p_max numeric, p_due date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not is_owner() then raise exception 'Hanya pemilik'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  insert into assignment_exceptions(user_id, reason, max_amount, due_date, approved_by)
  values (p_user, p_reason, p_max, p_due, auth.uid()) returning id into v;
  perform notify_user(p_user, 'Pengecualian pengajuan modal', 'Batas Rp' || to_char(p_max, 'FM999G999G999G990') || ' sampai ' || p_due, null, 'exc:' || v);
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Verifikasi
-- ---------------------------------------------------------------------
create or replace function public.verify_purchase(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_office() then raise exception 'Tidak berwenang'; end if;
  update purchases set status = 'verified', verified_by = auth.uid(), verified_at = now() where id = p_id and status = 'submitted';
end $$;

create or replace function public.review_attachment(p_id uuid, p_valid boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_office() then raise exception 'Tidak berwenang'; end if;
  update attachments set verify_status = case when p_valid then 'valid' else 'rejected' end,
    verified_by = auth.uid(), verified_at = now(), note = coalesce(p_note, note) where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Tutup periode
-- ---------------------------------------------------------------------
create or replace function public.close_period(p_period text, p_close boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Hanya pemilik'; end if;
  insert into accounting_periods(period, closed_at, closed_by)
  values (p_period, case when p_close then now() end, case when p_close then auth.uid() end)
  on conflict (period) do update set closed_at = excluded.closed_at, closed_by = excluded.closed_by;
end $$;

-- ---------------------------------------------------------------------
-- Pengingat otomatis (dijalankan pg_cron setiap pagi)
-- ---------------------------------------------------------------------
create or replace function public.generate_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_today text := to_char(current_date, 'YYYYMMDD');
  v_transit int := setting_num('transit_days', 3)::int; v_adv int := setting_num('advance_open_days', 30)::int;
begin
  perform set_config('app.system', '1', true);

  -- Pertanggungjawaban terlambat
  for r in select a.*, p.full_name from assignments a join profiles p on p.id = a.user_id
           where a.status in ('disbursed','active','lpj_returned') and a.due_date < current_date loop
    perform notify_user(r.user_id, 'Pertanggungjawaban terlambat', r.no || ' lewat tenggat ' || r.due_date, null, 'lpjlate:' || r.id || ':' || v_today);
    perform notify_role(array['owner','finance'], 'Pertanggungjawaban terlambat', r.no || ' - ' || r.full_name, '/modal/' || r.id, 'lpjlate:' || r.id || ':' || v_today);
    n := n + 1;
  end loop;

  -- Bukti belum lengkap pada LPJ yang menunggu
  for r in select a.id, a.no, (select count(*) from assignment_missing_proofs(a.id)) c
           from assignments a where a.status = 'lpj_submitted' loop
    if r.c > 0 then
      perform notify_role(array['owner','finance'], 'Bukti belum lengkap', r.no || ': ' || r.c || ' item', '/modal/' || r.id, 'proof:' || r.id || ':' || v_today);
      n := n + 1;
    end if;
  end loop;

  -- Selisih kas pada LPJ
  for r in select a.id, a.no, l.cash_diff from accountabilities l join assignments a on a.id = l.assignment_id
           where l.status = 'submitted' and l.cash_diff <> 0 loop
    perform notify_role(array['owner','finance'], 'Selisih kas petugas', r.no || ': Rp' || r.cash_diff, '/modal/' || r.id, 'cashdiff:' || r.id || ':' || v_today);
    n := n + 1;
  end loop;

  -- Barang belum diterima gudang
  for r in select id, no from purchases where status <> 'cancelled' and goods_status <> 'received'
           and purchase_date < current_date - v_transit loop
    perform notify_role(array['owner','warehouse'], 'Barang belum masuk gudang', r.no || ' lebih dari ' || v_transit || ' hari', '/pembelian/' || r.id, 'transit:' || r.id);
    n := n + 1;
  end loop;

  -- Panjar belum selesai
  for r in select a.id, a.no, a.user_id, s.name from advances a join suppliers s on s.id = a.supplier_id
           where a.status = 'open' and a.given_at < current_date - v_adv loop
    perform notify_user(r.user_id, 'Panjar belum selesai', r.no || ' - ' || r.name, null, 'adv:' || r.id);
    perform notify_role(array['owner','finance'], 'Panjar belum selesai', r.no || ' - ' || r.name, '/pembelian/panjar', 'adv:' || r.id);
    n := n + 1;
  end loop;

  -- Tagihan jatuh tempo (3 hari lagi atau lewat)
  for r in select i.id, i.no, i.due_date, i.sales_order_id, f.name from invoices i
           join sales_orders so on so.id = i.sales_order_id join factories f on f.id = so.factory_id
           where i.status in ('unpaid','partial') and i.due_date <= current_date + 3 loop
    perform notify_role(array['owner','finance'],
      case when r.due_date < current_date then 'Tagihan lewat jatuh tempo' else 'Tagihan segera jatuh tempo' end,
      r.no || ' - ' || r.name || ' (' || r.due_date || ')', '/penjualan/' || r.sales_order_id,
      'inv:' || r.id || ':' || case when r.due_date < current_date then 'over' else 'due' end);
    n := n + 1;
  end loop;

  -- Stok menipis
  for r in select p.id, p.name, p.min_stock_kg, coalesce(sum(m.qty_kg), 0) bal
           from products p left join lots l on l.product_id = p.id left join stock_movements m on m.lot_id = l.id
           where p.min_stock_kg > 0 group by p.id having coalesce(sum(m.qty_kg), 0) < p.min_stock_kg loop
    perform notify_role(array['owner','warehouse'], 'Stok menipis', r.name || ': ' || round(r.bal) || ' kg (minimal ' || r.min_stock_kg || ' kg)', '/gudang/stok', 'stock:' || r.id || ':' || v_today);
    n := n + 1;
  end loop;

  -- Harga pabrik perlu diperbarui
  for r in select v.id, v.factory_name, v.product_name from v_factory_prices_current v where v.price_status = 'expired' loop
    perform notify_role(array['owner'], 'Harga pabrik kedaluwarsa', r.factory_name || ' - ' || r.product_name, '/pabrik', 'price:' || r.id);
    n := n + 1;
  end loop;

  perform set_config('app.system', '0', true);
  return n;
end $$;
