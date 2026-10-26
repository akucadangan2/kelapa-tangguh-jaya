-- =====================================================================
-- FUNGSI INTI: peran, pengaturan, penomoran, kas, jurnal, audit
-- =====================================================================

-- ---------- Peran ----------
create or replace function public.has_role(r text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles ur join profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and ur.role = r and p.is_active);
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('owner');
$$;

create or replace function public.is_office()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('owner') or public.has_role('finance');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles ur join profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and p.is_active);
$$;

create or replace function public.my_flag(flag text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner() or coalesce((
    select case flag when 'sell_price' then can_view_sell_price
                     when 'salary' then can_view_salary
                     when 'profit' then can_view_profit end
    from profiles where id = auth.uid()), false);
$$;

create or replace function public.setting_num(k text, fallback numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from settings where key = k), fallback);
$$;

-- ---------- Penomoran dokumen: PB-2610-0001 ----------
create or replace function public.next_doc_no(p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYMM'); v_no int;
begin
  insert into doc_counters(prefix, period, last_no) values (p_prefix, v_period, 1)
  on conflict (prefix, period) do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;
  return p_prefix || '-' || v_period || '-' || lpad(v_no::text, 4, '0');
end $$;

create or replace function public.tg_set_doc_no()
returns trigger language plpgsql as $$
begin
  if new.no is null or new.no = '' then new.no := public.next_doc_no(TG_ARGV[0]); end if;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('assignments','PM'), ('accountabilities','LPJ'), ('cash_transfers','TRF'),
    ('purchases','PB'), ('advances','PJ'), ('goods_receipts','BM'),
    ('stock_opnames','OPN'), ('stock_adjustments','ADJ'), ('production_batches','PRD'),
    ('sales_orders','SO'), ('goods_dispatches','BK'), ('sales_returns','RTR'),
    ('invoices','INV'), ('expenses','KK'), ('payrolls','GJ'), ('bonuses','BNS'),
    ('journal_entries','JU')) as t(tbl, prefix)
  loop
    execute format('create trigger set_doc_no before insert on public.%I for each row execute function public.tg_set_doc_no(%L)', r.tbl, r.prefix);
  end loop;
end $$;

create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch before update on public.suppliers for each row execute function public.tg_touch_updated_at();

-- ---------- Periode akuntansi ----------
create or replace function public.assert_period_open(p_date date)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from accounting_periods where period = to_char(p_date, 'YYYY-MM') and closed_at is not null) then
    raise exception 'Periode % sudah ditutup. Buka periode atau catat koreksi di periode berjalan.', to_char(p_date, 'YYYY-MM');
  end if;
end $$;

-- ---------- Buku kas ----------
create or replace function public.cash_coa(p_account uuid)
returns text language sql stable security definer set search_path = public as $$
  select coa_code from cash_accounts where id = p_account;
$$;

create or replace function public.post_cash(p_account uuid, p_date date, p_dir text, p_amount numeric,
                                            p_ref_type text, p_ref_id uuid, p_desc text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_account is null or coalesce(p_amount, 0) <= 0 then return; end if;
  insert into cash_transactions(account_id, trx_date, direction, amount, ref_type, ref_id, description, created_by)
  values (p_account, p_date, p_dir, p_amount, p_ref_type, p_ref_id, p_desc, auth.uid());
end $$;

-- ---------- Jurnal ----------
-- p_lines: [{"a":"1101","d":1000,"c":0,"cash":"<uuid opsional>","m":"memo"}]
create or replace function public.post_journal(p_date date, p_desc text, p_ref_type text, p_ref_id uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_d numeric; v_c numeric;
begin
  select coalesce(sum(coalesce((l->>'d')::numeric, 0)), 0), coalesce(sum(coalesce((l->>'c')::numeric, 0)), 0)
    into v_d, v_c from jsonb_array_elements(p_lines) l;
  if v_d = 0 and v_c = 0 then return null; end if;
  if round(v_d, 2) <> round(v_c, 2) then
    raise exception 'Jurnal tidak seimbang: debit % kredit %', v_d, v_c;
  end if;
  perform assert_period_open(p_date);
  insert into journal_entries(entry_date, description, ref_type, ref_id, is_manual)
  values (p_date, p_desc, p_ref_type, p_ref_id, false) returning id into v_id;
  insert into journal_lines(entry_id, account_code, debit, credit, cash_account_id, memo)
  select v_id, l->>'a', round(coalesce((l->>'d')::numeric, 0), 2), round(coalesce((l->>'c')::numeric, 0), 2),
         nullif(l->>'cash', '')::uuid, l->>'m'
  from jsonb_array_elements(p_lines) l
  where coalesce((l->>'d')::numeric, 0) <> 0 or coalesce((l->>'c')::numeric, 0) <> 0;
  return v_id;
end $$;

-- Hapus semua jurnal & mutasi kas dari satu transaksi sumber (dipakai saat koreksi/hapus)
create or replace function public.unpost(p_ref_type text, p_ref_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d date;
begin
  for d in select entry_date from journal_entries where ref_type = p_ref_type and ref_id = p_ref_id loop
    perform assert_period_open(d);
  end loop;
  delete from journal_entries where ref_type = p_ref_type and ref_id = p_ref_id;
  delete from cash_transactions where ref_type = p_ref_type and ref_id = p_ref_id;
end $$;

-- Jurnal manual dari website (pemilik/keuangan)
create or replace function public.create_manual_journal(p_date date, p_desc text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_office() then raise exception 'Tidak berwenang'; end if;
  v_id := post_journal(p_date, p_desc, 'manual', null, p_lines);
  update journal_entries set is_manual = true, created_by = auth.uid() where id = v_id;
  return v_id;
end $$;

-- ---------- Notifikasi ----------
create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text, p_key text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into notifications(user_id, title, body, link, dedupe_key)
  values (p_user, p_title, p_body, p_link, p_key)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

create or replace function public.notify_role(p_roles text[], p_title text, p_body text, p_link text, p_key text default null)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select distinct ur.user_id from user_roles ur join profiles p on p.id = ur.user_id
           where ur.role = any(p_roles) and p.is_active loop
    perform notify_user(u, p_title, p_body, p_link, p_key);
  end loop;
end $$;

-- ---------- Jejak perubahan ----------
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs(table_name, record_id, action, old_data, new_data, user_id)
  values (TG_TABLE_NAME,
          case when TG_OP = 'DELETE' then old.id else new.id end,
          TG_OP,
          case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) end,
          auth.uid());
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['purchases','purchase_payments','advances','advance_allocations','advance_returns',
    'expenses','assignments','accountabilities','assignment_exceptions','cash_transfers','invoices','invoice_payments',
    'payrolls','bonuses','factory_prices','stock_adjustments','stock_opnames','goods_receipts','goods_dispatches',
    'factory_receipts','sales_orders','sales_returns','production_batches','production_costs','journal_entries',
    'cash_accounts','suppliers']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Profil otomatis saat akun dibuat
create or replace function public.tg_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.tg_new_user();

-- Kas petugas otomatis saat seseorang diberi peran petugas lapangan
create or replace function public.tg_role_field_cash()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'field' and not exists (select 1 from cash_accounts where type = 'field' and owner_id = new.user_id) then
    insert into cash_accounts(name, type, owner_id, coa_code)
    select 'Kas Petugas - ' || coalesce(nullif(full_name, ''), 'Petugas'), 'field', id, '1103' from profiles where id = new.user_id;
  end if;
  return new;
end $$;
create trigger role_field_cash after insert on public.user_roles for each row execute function public.tg_role_field_cash();
