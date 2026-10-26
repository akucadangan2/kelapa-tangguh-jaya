-- =====================================================================
-- TRIGGER BISNIS: perhitungan, stok, kas, jurnal otomatis
-- Semua logika ada di database supaya data dari website maupun
-- aplikasi Android (termasuk hasil sinkron offline) diproses sama.
--
-- Akun utama:
-- 1101 Kas Usaha, 1102 Bank, 1103 Kas Petugas, 1201 Piutang, 1202 Panjar,
-- 1301 Persediaan, 1302 Barang Dalam Proses, 1303 Barang Dalam Pengiriman,
-- 2101 Utang Pemasok, 2102 Utang Lain, 3101 Modal, 4101 Penjualan,
-- 5101 HPP, 5102 Susut/Selisih Persediaan, 6xxx Biaya
-- =====================================================================

create or replace function public.is_system() returns boolean language sql stable as $$
  select coalesce(current_setting('app.system', true), '0') = '1';
$$;

create or replace function public.lot_balance(p_lot uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(qty_kg), 0) from stock_movements where lot_id = p_lot;
$$;

create or replace function public.refresh_lot_status(p_lot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_bal numeric := lot_balance(p_lot);
begin
  update lots set status = case
      when v_bal > 0.0005 then 'available'
      when exists (select 1 from stock_movements where lot_id = p_lot and type = 'out') then 'shipped'
      when exists (select 1 from stock_movements where lot_id = p_lot and type = 'production_out') then 'in_production'
      else 'closed' end
  where id = p_lot;
end $$;

-- =====================================================================
-- PEMBELIAN
-- =====================================================================
create or replace function public.tg_purchase_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and old.status = 'verified' and not is_office() and not is_system() then
    raise exception 'Pembelian % sudah diverifikasi. Koreksi hanya oleh admin/keuangan.', old.no;
  end if;
  new.net_kg := new.gross_kg - new.tare_kg;
  new.agreed_kg := greatest(new.net_kg - new.deduction_kg, 0);
  new.total_amount := round(new.agreed_kg * new.price_per_kg, 0) - new.deduction_amount;
  new.balance_due := new.total_amount - new.advance_allocated - new.paid_amount;
  if TG_OP = 'INSERT' and new.max_price_at_purchase is null then
    new.max_price_at_purchase := coalesce(
      (select approved_max_price from assignment_items where assignment_id = new.assignment_id and product_id = new.product_id limit 1),
      (select max_buy_price from suppliers where id = new.supplier_id));
  end if;
  new.over_limit := new.max_price_at_purchase is not null and new.price_per_kg > new.max_price_at_purchase;
  return new;
end $$;
create trigger purchase_before before insert or update on public.purchases
for each row execute function public.tg_purchase_before();

create or replace function public.tg_purchase_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.purchases;
begin
  if TG_OP = 'DELETE' then perform unpost('purchase', old.id); return old; end if;
  r := new;
  if TG_OP = 'INSERT' or (old.total_amount, old.status, old.purchase_date) is distinct from (new.total_amount, new.status, new.purchase_date) then
    perform unpost('purchase', r.id);
    if r.status <> 'cancelled' and r.total_amount > 0 then
      perform post_journal(r.purchase_date, 'Pembelian ' || r.no, 'purchase', r.id, jsonb_build_array(
        jsonb_build_object('a','1301','d', r.total_amount),
        jsonb_build_object('a','2101','c', r.total_amount)));
    end if;
    -- harga lot ikut koreksi jika barang sudah diterima
    update lots l set unit_cost = r.total_amount / nullif(g.received_kg, 0)
    from goods_receipts g where g.purchase_id = r.id and l.id = g.lot_id;
  end if;
  if TG_OP = 'INSERT' and r.over_limit then
    perform notify_role(array['owner'], 'Harga beli melebihi batas',
      r.no || ': Rp' || r.price_per_kg || '/kg, batas Rp' || r.max_price_at_purchase, '/pembelian/' || r.id, 'overlimit:' || r.id);
  end if;
  return r;
end $$;
create trigger purchase_after after insert or update or delete on public.purchases
for each row execute function public.tg_purchase_after();

create or replace function public.recompute_purchase(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.system', '1', true);
  update purchases set
    advance_allocated = coalesce((select sum(amount) from advance_allocations where purchase_id = p_id), 0),
    paid_amount = coalesce((select sum(amount) from purchase_payments where purchase_id = p_id), 0)
  where id = p_id;
  perform set_config('app.system', '0', true);
end $$;

-- Rincian timbang menjumlahkan bruto/tara ke header pembelian
create or replace function public.tg_weighing_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid uuid := coalesce(new.purchase_id, old.purchase_id);
begin
  perform set_config('app.system', '1', true);
  update purchases set
    gross_kg = coalesce((select sum(gross_kg) from purchase_weighings where purchase_id = v_pid), 0),
    tare_kg  = coalesce((select sum(tare_kg)  from purchase_weighings where purchase_id = v_pid), 0)
  where id = v_pid;
  perform set_config('app.system', '0', true);
  return coalesce(new, old);
end $$;
create trigger weighing_after after insert or update or delete on public.purchase_weighings
for each row execute function public.tg_weighing_after();

create or replace function public.tg_purchase_payment_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_no text;
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('purchase_payment', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    select no into v_no from purchases where id = new.purchase_id;
    perform post_cash(new.cash_account_id, new.paid_at, 'out', new.amount, 'purchase_payment', new.id, 'Bayar pembelian ' || v_no);
    perform post_journal(new.paid_at, 'Bayar pembelian ' || v_no, 'purchase_payment', new.id, jsonb_build_array(
      jsonb_build_object('a','2101','d', new.amount),
      jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.amount, 'cash', new.cash_account_id)));
  end if;
  perform recompute_purchase(coalesce(new.purchase_id, old.purchase_id));
  return coalesce(new, old);
end $$;
create trigger purchase_payment_after after insert or update or delete on public.purchase_payments
for each row execute function public.tg_purchase_payment_after();

-- =====================================================================
-- PANJAR PETANI
-- =====================================================================
create or replace function public.recompute_advance(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update advances a set
    allocated_amount = coalesce((select sum(amount) from advance_allocations where advance_id = p_id), 0),
    returned_amount  = coalesce((select sum(amount) from advance_returns where advance_id = p_id), 0)
  where id = p_id;
  update advances set remaining = amount - allocated_amount - returned_amount,
    status = case when status = 'cancelled' then 'cancelled'
                  when amount - allocated_amount - returned_amount <= 0 then 'settled' else 'open' end
  where id = p_id;
end $$;

create or replace function public.tg_advance_before()
returns trigger language plpgsql as $$
begin
  new.remaining := new.amount - new.allocated_amount - new.returned_amount;
  return new;
end $$;
create trigger advance_before before insert or update on public.advances
for each row execute function public.tg_advance_before();

create or replace function public.tg_advance_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then perform unpost('advance', old.id); return old; end if;
  if TG_OP = 'INSERT' or (old.amount, old.cash_account_id, old.given_at, old.status = 'cancelled') is distinct from
                         (new.amount, new.cash_account_id, new.given_at, new.status = 'cancelled') then
    perform unpost('advance', new.id);
    if new.status <> 'cancelled' then
      perform post_cash(new.cash_account_id, new.given_at, 'out', new.amount, 'advance', new.id, 'Panjar ' || new.no);
      perform post_journal(new.given_at, 'Panjar ' || new.no, 'advance', new.id, jsonb_build_array(
        jsonb_build_object('a','1202','d', new.amount),
        jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.amount, 'cash', new.cash_account_id)));
    end if;
  end if;
  return new;
end $$;
create trigger advance_after after insert or update or delete on public.advances
for each row execute function public.tg_advance_after();

create or replace function public.tg_advance_alloc_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.advances; p public.purchases;
begin
  select * into a from advances where id = new.advance_id;
  select * into p from purchases where id = new.purchase_id;
  if a.supplier_id <> p.supplier_id then raise exception 'Panjar bukan milik pemasok pembelian ini'; end if;
  if a.status = 'cancelled' then raise exception 'Panjar % dibatalkan', a.no; end if;
  if new.amount > a.remaining + 0.001 then raise exception 'Alokasi melebihi sisa panjar % (sisa %)', a.no, a.remaining; end if;
  return new;
end $$;
create trigger advance_alloc_before before insert on public.advance_allocations
for each row execute function public.tg_advance_alloc_before();

-- Alokasi panjar memindahkan utang ke pemasok menjadi pelunasan panjar (bukan biaya baru)
create or replace function public.tg_advance_alloc_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_date date; v_no text;
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('advance_allocation', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    select purchase_date, no into v_date, v_no from purchases where id = new.purchase_id;
    perform post_journal(v_date, 'Potong panjar pada ' || v_no, 'advance_allocation', new.id, jsonb_build_array(
      jsonb_build_object('a','2101','d', new.amount),
      jsonb_build_object('a','1202','c', new.amount)));
  end if;
  perform recompute_advance(coalesce(new.advance_id, old.advance_id));
  perform recompute_purchase(coalesce(new.purchase_id, old.purchase_id));
  return coalesce(new, old);
end $$;
create trigger advance_alloc_after after insert or update or delete on public.advance_allocations
for each row execute function public.tg_advance_alloc_after();

create or replace function public.tg_advance_return_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_no text;
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('advance_return', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    select no into v_no from advances where id = new.advance_id;
    perform post_cash(new.cash_account_id, new.returned_at, 'in', new.amount, 'advance_return', new.id, 'Pengembalian panjar ' || v_no);
    perform post_journal(new.returned_at, 'Pengembalian panjar ' || v_no, 'advance_return', new.id, jsonb_build_array(
      jsonb_build_object('a', cash_coa(new.cash_account_id), 'd', new.amount, 'cash', new.cash_account_id),
      jsonb_build_object('a','1202','c', new.amount)));
  end if;
  perform recompute_advance(coalesce(new.advance_id, old.advance_id));
  return coalesce(new, old);
end $$;
create trigger advance_return_after after insert or update or delete on public.advance_returns
for each row execute function public.tg_advance_return_after();

-- =====================================================================
-- PENGELUARAN, GAJI, BONUS, TRANSFER ANTARKAS
-- =====================================================================
create or replace function public.tg_expense_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' and old.status in ('valid') and not is_office() then
    raise exception 'Pengeluaran % sudah divalidasi', old.no;
  end if;
  return new;
end $$;
create trigger expense_before before update on public.expenses
for each row execute function public.tg_expense_before();

create or replace function public.tg_expense_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_coa text;
begin
  if TG_OP = 'DELETE' then perform unpost('expense', old.id); return old; end if;
  if TG_OP = 'INSERT' or (old.amount, old.cash_account_id, old.expense_date, old.category_id, old.status = 'cancelled') is distinct from
                         (new.amount, new.cash_account_id, new.expense_date, new.category_id, new.status = 'cancelled') then
    perform unpost('expense', new.id);
    if new.status <> 'cancelled' then
      select coa_code into v_coa from expense_categories where id = new.category_id;
      perform post_cash(new.cash_account_id, new.expense_date, 'out', new.amount, 'expense', new.id,
                        coalesce(new.description, 'Pengeluaran ' || new.no));
      perform post_journal(new.expense_date, 'Pengeluaran ' || new.no || coalesce(' - ' || new.description, ''), 'expense', new.id,
        jsonb_build_array(
          jsonb_build_object('a', v_coa, 'd', new.amount),
          jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.amount, 'cash', new.cash_account_id)));
    end if;
  end if;
  return new;
end $$;
create trigger expense_after after insert or update or delete on public.expenses
for each row execute function public.tg_expense_after();

create or replace function public.tg_payroll_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('payroll', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') and new.net_amount > 0 then
    perform post_cash(new.cash_account_id, new.paid_at, 'out', new.net_amount, 'payroll', new.id, 'Gaji ' || new.employee_name || ' ' || new.period);
    perform post_journal(new.paid_at, 'Gaji ' || new.employee_name || ' ' || new.period, 'payroll', new.id, jsonb_build_array(
      jsonb_build_object('a','6101','d', new.net_amount),
      jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.net_amount, 'cash', new.cash_account_id)));
  end if;
  return coalesce(new, old);
end $$;
create trigger payroll_after after insert or update or delete on public.payrolls
for each row execute function public.tg_payroll_after();

create or replace function public.tg_bonus_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('bonus', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    perform post_cash(new.cash_account_id, new.paid_at, 'out', new.amount, 'bonus', new.id, 'Bonus ' || new.recipient_name);
    perform post_journal(new.paid_at, 'Bonus ' || new.recipient_name || ' - ' || new.reason, 'bonus', new.id, jsonb_build_array(
      jsonb_build_object('a','6102','d', new.amount),
      jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.amount, 'cash', new.cash_account_id)));
  end if;
  return coalesce(new, old);
end $$;
create trigger bonus_after after insert or update or delete on public.bonuses
for each row execute function public.tg_bonus_after();

-- Transfer antarkas tidak dihitung sebagai biaya
create or replace function public.tg_transfer_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_desc text; v_lines jsonb;
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('transfer', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    v_desc := case new.type when 'disbursement' then 'Pencairan modal petugas' when 'return' then 'Setoran sisa kas petugas'
                            when 'capital_in' then 'Setoran modal pemilik' when 'capital_out' then 'Penarikan pemilik'
                            else 'Transfer antarkas' end || ' ' || new.no;
    perform post_cash(new.from_account_id, new.transfer_date, 'out', new.amount, 'transfer', new.id, v_desc);
    perform post_cash(new.to_account_id, new.transfer_date, 'in', new.amount, 'transfer', new.id, v_desc);
    v_lines := jsonb_build_array(
      case when new.to_account_id is not null
           then jsonb_build_object('a', cash_coa(new.to_account_id), 'd', new.amount, 'cash', new.to_account_id)
           else jsonb_build_object('a','3101','d', new.amount) end,
      case when new.from_account_id is not null
           then jsonb_build_object('a', cash_coa(new.from_account_id), 'c', new.amount, 'cash', new.from_account_id)
           else jsonb_build_object('a','3101','c', new.amount) end);
    perform post_journal(new.transfer_date, v_desc, 'transfer', new.id, v_lines);
  end if;
  return coalesce(new, old);
end $$;
create trigger transfer_after after insert or update or delete on public.cash_transfers
for each row execute function public.tg_transfer_after();

-- =====================================================================
-- GUDANG: TERIMA BARANG -> LOT
-- =====================================================================
create or replace function public.tg_goods_receipt_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.purchases; v_lot uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.received_kg <> old.received_kg then
      raise exception 'Berat diterima tidak bisa diubah. Gunakan penyesuaian stok.';
    end if;
    return new;
  end if;
  select * into p from purchases where id = new.purchase_id;
  if p.goods_status = 'received' then raise exception 'Barang pembelian % sudah diterima gudang', p.no; end if;
  if p.status = 'cancelled' then raise exception 'Pembelian % dibatalkan', p.no; end if;
  new.diff_kg := new.received_kg - p.net_kg;
  insert into lots(code, product_id, grade_id, condition, warehouse_id, source_type, source_id, supplier_id,
                   initial_kg, unit_cost, storage_location)
  values (next_doc_no('LOT'), p.product_id, coalesce(new.grade_id, p.grade_id), coalesce(new.condition, p.condition),
          new.warehouse_id, 'purchase', p.id, p.supplier_id, new.received_kg,
          p.total_amount / new.received_kg, new.storage_location)
  returning id into v_lot;
  new.lot_id := v_lot;
  return new;
end $$;
create trigger goods_receipt_before before insert or update on public.goods_receipts
for each row execute function public.tg_goods_receipt_before();

create or replace function public.tg_goods_receipt_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.purchases; v_tol numeric := setting_num('weight_tolerance_pct', 2);
begin
  select * into p from purchases where id = new.purchase_id;
  insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, moved_at, note)
  values (new.lot_id, new.warehouse_id, 'in', new.received_kg, p.total_amount / new.received_kg,
          'goods_receipt', new.id, new.received_at, 'Terima ' || p.no);
  perform set_config('app.system', '1', true);
  update purchases set goods_status = 'received' where id = p.id;
  perform set_config('app.system', '0', true);
  if p.net_kg > 0 and abs(new.diff_kg) / p.net_kg * 100 > v_tol then
    perform notify_role(array['owner','finance'], 'Selisih timbang masuk gudang',
      p.no || ': beli ' || p.net_kg || ' kg, diterima ' || new.received_kg || ' kg', '/pembelian/' || p.id, 'rcvdiff:' || new.id);
  end if;
  return new;
end $$;
create trigger goods_receipt_after after insert on public.goods_receipts
for each row execute function public.tg_goods_receipt_after();

-- =====================================================================
-- GUDANG: KELUAR BARANG UNTUK PENJUALAN
-- =====================================================================
create or replace function public.tg_dispatch_lot_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  v_bal := lot_balance(new.lot_id);
  if new.qty_kg > v_bal + 0.001 then
    raise exception 'Stok lot % tidak cukup (sisa % kg)', (select code from lots where id = new.lot_id), v_bal;
  end if;
  new.unit_cost := (select unit_cost from lots where id = new.lot_id);
  return new;
end $$;
create trigger dispatch_lot_before before insert on public.dispatch_lots
for each row execute function public.tg_dispatch_lot_before();

create or replace function public.recompute_dispatch(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update goods_dispatches set
    total_kg = coalesce((select sum(qty_kg) from dispatch_lots where dispatch_id = p_id), 0),
    cost_amount = coalesce((select round(sum(qty_kg * unit_cost), 2) from dispatch_lots where dispatch_id = p_id), 0)
  where id = p_id;
end $$;

create or replace function public.tg_dispatch_lot_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.goods_dispatches; v_cost numeric;
begin
  if TG_OP = 'DELETE' then
    delete from stock_movements where ref_type = 'dispatch_lot' and ref_id = old.id;
    perform unpost('dispatch_lot', old.id);
    perform recompute_dispatch(old.dispatch_id);
    perform refresh_lot_status(old.lot_id);
    return old;
  end if;
  select * into d from goods_dispatches where id = new.dispatch_id;
  v_cost := round(new.qty_kg * new.unit_cost, 2);
  insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, moved_at, note)
  values (new.lot_id, d.warehouse_id, 'out', -new.qty_kg, new.unit_cost, 'dispatch_lot', new.id, d.dispatched_at, 'Keluar ' || d.no);
  perform post_journal((d.dispatched_at at time zone 'Asia/Jakarta')::date, 'Barang keluar ' || d.no, 'dispatch_lot', new.id,
    jsonb_build_array(jsonb_build_object('a','1303','d', v_cost), jsonb_build_object('a','1301','c', v_cost)));
  perform recompute_dispatch(new.dispatch_id);
  perform refresh_lot_status(new.lot_id);
  update sales_orders set status = 'shipped' where id = d.sales_order_id and status = 'confirmed';
  return new;
end $$;
create trigger dispatch_lot_after after insert or delete on public.dispatch_lots
for each row execute function public.tg_dispatch_lot_after();

create or replace function public.tg_factory_receipt_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.diff_kg := new.received_kg - (select total_kg from goods_dispatches where id = new.dispatch_id);
  return new;
end $$;
create trigger factory_receipt_before before insert or update on public.factory_receipts
for each row execute function public.tg_factory_receipt_before();

create or replace function public.tg_factory_receipt_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.goods_dispatches; v_tol numeric := setting_num('weight_tolerance_pct', 2);
begin
  select * into d from goods_dispatches where id = new.dispatch_id;
  update goods_dispatches set status = 'received' where id = d.id and status = 'in_transit';
  if not exists (select 1 from goods_dispatches where sales_order_id = d.sales_order_id and status = 'in_transit') then
    update sales_orders set status = 'received' where id = d.sales_order_id and status in ('confirmed','shipped');
  end if;
  perform notify_role(array['owner','finance'], 'Barang diterima pabrik',
    d.no || ': diterima ' || new.received_kg || ' kg. Silakan buat tagihan.', '/penjualan/' || d.sales_order_id, 'facrcv:' || new.id);
  if d.total_kg > 0 and abs(new.diff_kg) / d.total_kg * 100 > v_tol then
    perform notify_role(array['owner','finance'], 'Selisih timbang pabrik',
      d.no || ': keluar ' || d.total_kg || ' kg, diterima pabrik ' || new.received_kg || ' kg', '/penjualan/' || d.sales_order_id, 'facdiff:' || new.id);
  end if;
  return new;
end $$;
create trigger factory_receipt_after after insert on public.factory_receipts
for each row execute function public.tg_factory_receipt_after();

create or replace function public.tg_sales_return_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cost numeric; v_unit numeric; v_wh uuid;
begin
  if new.action = 'return_to_warehouse' then
    select unit_cost into v_unit from dispatch_lots where dispatch_id = new.dispatch_id and lot_id = new.lot_id limit 1;
    v_unit := coalesce(v_unit, (select unit_cost from lots where id = new.lot_id));
    v_wh := coalesce(new.warehouse_id, (select warehouse_id from goods_dispatches where id = new.dispatch_id));
    v_cost := round(new.qty_kg * v_unit, 2);
    insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
    values (new.lot_id, v_wh, 'return_in', new.qty_kg, v_unit, 'sales_return', new.id, 'Retur ' || new.no);
    perform post_journal(current_date, 'Retur penjualan ' || new.no, 'sales_return', new.id, jsonb_build_array(
      jsonb_build_object('a','1301','d', v_cost), jsonb_build_object('a','1303','c', v_cost)));
    perform refresh_lot_status(new.lot_id);
  end if;
  update goods_dispatches set status = 'partial' where id = new.dispatch_id;
  return new;
end $$;
create trigger sales_return_after after insert on public.sales_returns
for each row execute function public.tg_sales_return_after();

-- =====================================================================
-- TAGIHAN & PEMBAYARAN PABRIK
-- =====================================================================
create or replace function public.tg_invoice_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_returned numeric;
begin
  new.total_amount := round(new.accepted_kg * new.price_per_kg, 0) - new.deduction_amount;
  select coalesce(sum(round(sr.qty_kg * coalesce(dl.unit_cost, 0), 2)), 0) into v_returned
  from sales_returns sr left join dispatch_lots dl on dl.dispatch_id = sr.dispatch_id and dl.lot_id = sr.lot_id
  where sr.dispatch_id = new.dispatch_id and sr.action = 'return_to_warehouse';
  new.cogs_amount := (select cost_amount from goods_dispatches where id = new.dispatch_id) - v_returned;
  if new.status <> 'cancelled' then
    new.status := case when new.paid_amount >= new.total_amount and new.total_amount > 0 then 'paid'
                       when new.paid_amount > 0 then 'partial' else 'unpaid' end;
  end if;
  return new;
end $$;
create trigger invoice_before before insert or update on public.invoices
for each row execute function public.tg_invoice_before();

create or replace function public.tg_invoice_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then perform unpost('invoice', old.id); return old; end if;
  if TG_OP = 'INSERT' or (old.total_amount, old.cogs_amount, old.invoice_date, old.status = 'cancelled') is distinct from
                         (new.total_amount, new.cogs_amount, new.invoice_date, new.status = 'cancelled') then
    perform unpost('invoice', new.id);
    if new.status <> 'cancelled' then
      perform post_journal(new.invoice_date, 'Tagihan ' || new.no, 'invoice', new.id, jsonb_build_array(
        jsonb_build_object('a','1201','d', new.total_amount),
        jsonb_build_object('a','4101','c', new.total_amount),
        jsonb_build_object('a','5101','d', new.cogs_amount),
        jsonb_build_object('a','1303','c', new.cogs_amount)));
    end if;
  end if;
  update sales_orders set status = case when new.status = 'paid' then 'closed' else 'invoiced' end
  where id = new.sales_order_id and status <> 'cancelled';
  return new;
end $$;
create trigger invoice_after after insert or update or delete on public.invoices
for each row execute function public.tg_invoice_after();

create or replace function public.tg_invoice_payment_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_no text; v_inv uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('invoice_payment', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    select no into v_no from invoices where id = new.invoice_id;
    perform post_cash(new.cash_account_id, new.paid_at, 'in', new.amount, 'invoice_payment', new.id, 'Pembayaran ' || v_no);
    perform post_journal(new.paid_at, 'Pembayaran tagihan ' || v_no, 'invoice_payment', new.id, jsonb_build_array(
      jsonb_build_object('a', cash_coa(new.cash_account_id), 'd', new.amount, 'cash', new.cash_account_id),
      jsonb_build_object('a','1201','c', new.amount)));
  end if;
  update invoices set paid_amount = coalesce((select sum(amount) from invoice_payments where invoice_id = v_inv), 0)
  where id = v_inv;
  return coalesce(new, old);
end $$;
create trigger invoice_payment_after after insert or update or delete on public.invoice_payments
for each row execute function public.tg_invoice_payment_after();

-- =====================================================================
-- PENYESUAIAN STOK & STOK OPNAME (berlaku setelah disetujui)
-- =====================================================================
create or replace function public.tg_adjustment_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare l public.lots; v_cost numeric; v_new uuid;
begin
  if not (new.status = 'approved' and old.status <> 'approved') then return new; end if;
  select * into l from lots where id = new.lot_id;
  if new.qty_kg > lot_balance(l.id) + 0.001 then raise exception 'Stok lot % tidak cukup', l.code; end if;
  v_cost := round(new.qty_kg * l.unit_cost, 2);
  if new.type in ('shrink','damage') then
    insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
    values (l.id, l.warehouse_id, new.type, -new.qty_kg, l.unit_cost, 'adjustment', new.id, new.reason);
    perform post_journal(current_date, 'Penyesuaian stok ' || new.no, 'adjustment', new.id, jsonb_build_array(
      jsonb_build_object('a','5102','d', v_cost), jsonb_build_object('a','1301','c', v_cost)));
  else
    insert into lots(code, product_id, grade_id, condition, warehouse_id, source_type, source_id, supplier_id,
                     initial_kg, unit_cost, storage_location)
    values (l.code || '-P' || to_char(now(), 'MMDDHH24MI'), l.product_id, l.grade_id, l.condition, new.to_warehouse_id,
            l.source_type, l.source_id, l.supplier_id, new.qty_kg, l.unit_cost, null)
    returning id into v_new;
    insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note) values
      (l.id, l.warehouse_id, 'transfer_out', -new.qty_kg, l.unit_cost, 'adjustment', new.id, 'Pindah gudang'),
      (v_new, new.to_warehouse_id, 'transfer_in', new.qty_kg, l.unit_cost, 'adjustment', new.id, 'Pindahan dari ' || l.code);
  end if;
  perform refresh_lot_status(l.id);
  return new;
end $$;
create trigger adjustment_after after update on public.stock_adjustments
for each row execute function public.tg_adjustment_after();

create or replace function public.tg_opname_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare i record; v_val numeric;
begin
  if not (new.status = 'approved' and old.status <> 'approved') then return new; end if;
  for i in select oi.*, l.unit_cost, l.warehouse_id from stock_opname_items oi join lots l on l.id = oi.lot_id
           where oi.opname_id = new.id and oi.diff_kg <> 0 loop
    insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
    values (i.lot_id, i.warehouse_id, 'opname', i.diff_kg, i.unit_cost, 'opname', new.id, coalesce(i.reason, 'Stok opname ' || new.no));
    v_val := round(abs(i.diff_kg) * i.unit_cost, 2);
    if v_val > 0 then
      perform post_journal(new.opname_date, 'Stok opname ' || new.no, 'opname_item', i.id,
        case when i.diff_kg < 0
             then jsonb_build_array(jsonb_build_object('a','5102','d', v_val), jsonb_build_object('a','1301','c', v_val))
             else jsonb_build_array(jsonb_build_object('a','1301','d', v_val), jsonb_build_object('a','5102','c', v_val)) end);
    end if;
    perform refresh_lot_status(i.lot_id);
  end loop;
  return new;
end $$;
create trigger opname_after after update on public.stock_opnames
for each row execute function public.tg_opname_after();

-- =====================================================================
-- PRODUKSI ARANG
-- =====================================================================
create or replace function public.recompute_batch(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update production_batches set
    input_kg   = coalesce((select sum(qty_kg) from production_inputs where batch_id = p_id), 0),
    input_cost = coalesce((select round(sum(qty_kg * unit_cost), 2) from production_inputs where batch_id = p_id), 0),
    other_cost = coalesce((select sum(amount) from production_costs where batch_id = p_id), 0)
  where id = p_id;
end $$;

create or replace function public.tg_prod_input_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bal numeric;
begin
  if (select status from production_batches where id = new.batch_id) <> 'running' then
    raise exception 'Batch sudah selesai';
  end if;
  v_bal := lot_balance(new.lot_id);
  if new.qty_kg > v_bal + 0.001 then raise exception 'Stok lot tidak cukup (sisa % kg)', v_bal; end if;
  new.unit_cost := (select unit_cost from lots where id = new.lot_id);
  return new;
end $$;
create trigger prod_input_before before insert on public.production_inputs
for each row execute function public.tg_prod_input_before();

create or replace function public.tg_prod_input_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.production_batches; v_cost numeric;
begin
  if TG_OP = 'DELETE' then
    delete from stock_movements where ref_type = 'production_input' and ref_id = old.id;
    perform unpost('production_input', old.id);
    perform recompute_batch(old.batch_id);
    perform refresh_lot_status(old.lot_id);
    return old;
  end if;
  select * into b from production_batches where id = new.batch_id;
  v_cost := round(new.qty_kg * new.unit_cost, 2);
  insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
  values (new.lot_id, b.warehouse_id, 'production_out', -new.qty_kg, new.unit_cost, 'production_input', new.id, 'Bahan ' || b.no);
  perform post_journal(b.batch_date, 'Bahan baku produksi ' || b.no, 'production_input', new.id, jsonb_build_array(
    jsonb_build_object('a','1302','d', v_cost), jsonb_build_object('a','1301','c', v_cost)));
  perform recompute_batch(new.batch_id);
  perform refresh_lot_status(new.lot_id);
  return new;
end $$;
create trigger prod_input_after after insert or delete on public.production_inputs
for each row execute function public.tg_prod_input_after();

create or replace function public.tg_prod_cost_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_no text; v_credit jsonb;
begin
  if TG_OP in ('UPDATE','DELETE') then perform unpost('production_cost', old.id); end if;
  if TG_OP in ('INSERT','UPDATE') then
    select no into v_no from production_batches where id = new.batch_id;
    perform post_cash(new.cash_account_id, new.cost_date, 'out', new.amount, 'production_cost', new.id, 'Biaya produksi ' || v_no);
    v_credit := case when new.cash_account_id is not null
      then jsonb_build_object('a', cash_coa(new.cash_account_id), 'c', new.amount, 'cash', new.cash_account_id)
      else jsonb_build_object('a','2102','c', new.amount) end;
    perform post_journal(new.cost_date, 'Biaya produksi ' || v_no, 'production_cost', new.id,
      jsonb_build_array(jsonb_build_object('a','1302','d', new.amount), v_credit));
  end if;
  perform recompute_batch(coalesce(new.batch_id, old.batch_id));
  return coalesce(new, old);
end $$;
create trigger prod_cost_after after insert or update or delete on public.production_costs
for each row execute function public.tg_prod_cost_after();

-- Rendemen = arang layak jual / tempurung terpakai x 100
-- HPP/kg   = total biaya batch / arang layak jual
create or replace function public.tg_batch_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_arang uuid;
begin
  new.total_cost := new.input_cost + new.other_cost;
  if new.input_kg > 0 then new.yield_pct := round(new.output_good_kg / new.input_kg * 100, 2); end if;
  if new.output_good_kg > 0 then new.hpp_per_kg := round(new.total_cost / new.output_good_kg, 2); end if;
  if TG_OP = 'UPDATE' and new.status = 'done' and old.status = 'running' then
    if new.output_good_kg <= 0 then raise exception 'Isi berat arang layak jual'; end if;
    if new.loss_kg = 0 then new.loss_kg := greatest(new.input_kg - new.output_good_kg - new.output_rework_kg, 0); end if;
    select id into v_arang from products where code = 'ARANG';
    insert into lots(code, product_id, grade_id, condition, warehouse_id, source_type, source_id, initial_kg, unit_cost)
    values (next_doc_no('LOT'), v_arang, new.grade_id, new.weight_basis, new.warehouse_id, 'production', new.id,
            new.output_good_kg, new.total_cost / new.output_good_kg)
    returning id into new.output_lot_id;
    if new.output_rework_kg > 0 then
      insert into lots(code, product_id, condition, warehouse_id, source_type, source_id, initial_kg, unit_cost, is_rework)
      values (next_doc_no('LOT'), v_arang, new.weight_basis, new.warehouse_id, 'production', new.id, new.output_rework_kg, 0, true)
      returning id into new.rework_lot_id;
    end if;
    new.finished_at := coalesce(new.finished_at, now());
  end if;
  if TG_OP = 'UPDATE' and old.status = 'done' and new.status <> 'done' then
    raise exception 'Batch yang sudah selesai tidak bisa dibuka kembali';
  end if;
  return new;
end $$;
create trigger batch_before before insert or update on public.production_batches
for each row execute function public.tg_batch_before();

create or replace function public.tg_batch_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status = 'running' then
    insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
    values (new.output_lot_id, new.warehouse_id, 'production_in', new.output_good_kg, new.hpp_per_kg, 'production', new.id, 'Hasil ' || new.no);
    if new.rework_lot_id is not null then
      insert into stock_movements(lot_id, warehouse_id, type, qty_kg, unit_cost, ref_type, ref_id, note)
      values (new.rework_lot_id, new.warehouse_id, 'production_in', new.output_rework_kg, 0, 'production', new.id, 'Perlu proses ulang ' || new.no);
    end if;
    perform post_journal(new.batch_date, 'Hasil produksi ' || new.no, 'production', new.id, jsonb_build_array(
      jsonb_build_object('a','1301','d', new.total_cost), jsonb_build_object('a','1302','c', new.total_cost)));
  end if;
  return new;
end $$;
create trigger batch_after after update on public.production_batches
for each row execute function public.tg_batch_after();
