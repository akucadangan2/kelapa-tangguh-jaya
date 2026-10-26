-- =====================================================================
-- ROW LEVEL SECURITY
-- owner    : semua data
-- finance  : semua data operasional & keuangan (gaji/laba sesuai izin)
-- field    : data miliknya sendiri + data petani
-- warehouse: gudang, stok, produksi, pengiriman
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','device_tokens','notifications','audit_logs','settings','doc_counters',
    'products','quality_grades','warehouses','vehicles','coa_accounts','expense_categories','cash_accounts',
    'attachments','suppliers','supplier_visits','assignments','assignment_items','assignment_costs',
    'assignment_exceptions','accountabilities','cash_transactions','cash_transfers','purchases',
    'purchase_weighings','purchase_payments','advances','advance_allocations','advance_returns','lots',
    'stock_movements','goods_receipts','stock_opnames','stock_opname_items','stock_adjustments',
    'production_batches','production_inputs','production_costs','factories','factory_prices','sales_orders',
    'sales_order_lots','goods_dispatches','dispatch_lots','factory_receipts','sales_returns','invoices',
    'invoice_payments','expenses','payrolls','bonuses','journal_entries','journal_lines',
    'accounting_periods','bank_reconciliations']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace function public.is_warehouse() returns boolean
language sql stable security definer set search_path = public as $$ select has_role('warehouse'); $$;
create or replace function public.is_field() returns boolean
language sql stable security definer set search_path = public as $$ select has_role('field'); $$;

-- ---------- Pengguna ----------
create policy profiles_select on profiles for select using (is_staff() or id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_owner on profiles for all using (is_owner()) with check (is_owner());

create policy roles_select on user_roles for select using (is_staff() or user_id = auth.uid());
create policy roles_owner on user_roles for all using (is_owner()) with check (is_owner());

create policy tokens_own on device_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_own on notifications for select using (user_id = auth.uid());
create policy notif_read on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_owner on audit_logs for select using (is_owner());

-- ---------- Master data: semua staf baca, pemilik ubah ----------
do $$
declare t text;
begin
  foreach t in array array['settings','products','quality_grades','warehouses','vehicles','coa_accounts','expense_categories'] loop
    execute format('create policy %I on public.%I for select using (is_staff())', t || '_read', t);
    execute format('create policy %I on public.%I for all using (is_owner()) with check (is_owner())', t || '_owner', t);
  end loop;
end $$;

-- ---------- Kas ----------
create policy cash_accounts_read on cash_accounts for select using (is_office() or owner_id = auth.uid());
create policy cash_accounts_write on cash_accounts for all using (is_office()) with check (is_office());
create policy cash_trx_read on cash_transactions for select
  using (is_office() or exists (select 1 from cash_accounts c where c.id = account_id and c.owner_id = auth.uid()));
create policy transfers_read on cash_transfers for select using (is_office()
  or exists (select 1 from cash_accounts c where c.id in (from_account_id, to_account_id) and c.owner_id = auth.uid()));
create policy transfers_write on cash_transfers for all using (is_office()) with check (is_office());

-- ---------- Lampiran ----------
create policy att_read on attachments for select using (
  is_office() or user_id = auth.uid()
  or (is_warehouse() and ref_type in ('purchase','goods_receipt','dispatch','factory_receipt','production','opname','adjustment')));
create policy att_insert on attachments for insert with check (is_staff() and user_id = auth.uid());
create policy att_update on attachments for update using (is_office() or (user_id = auth.uid() and verify_status = 'pending'));
create policy att_delete on attachments for delete using (is_office() or (user_id = auth.uid() and verify_status = 'pending'));

-- ---------- Petani ----------
create policy suppliers_read on suppliers for select using (is_office() or is_field() or is_warehouse());
create policy suppliers_insert on suppliers for insert with check (is_office() or is_field());
create policy suppliers_update on suppliers for update using (is_office() or created_by = auth.uid() or pic_user_id = auth.uid());
create policy visits_read on supplier_visits for select using (is_office() or user_id = auth.uid());
create policy visits_insert on supplier_visits for insert with check (user_id = auth.uid() or is_office());
create policy visits_update on supplier_visits for update using (user_id = auth.uid() or is_office());

-- ---------- Modal petugas ----------
create policy asg_read on assignments for select using (is_office() or user_id = auth.uid());
create policy asg_insert on assignments for insert with check (user_id = auth.uid() or is_office());
create policy asg_update on assignments for update using (is_office() or (user_id = auth.uid() and status = 'submitted'));
create policy asg_items_read on assignment_items for select using (exists (select 1 from assignments a where a.id = assignment_id));
create policy asg_items_write on assignment_items for all
  using (exists (select 1 from assignments a where a.id = assignment_id and (is_office() or (a.user_id = auth.uid() and a.status = 'submitted'))))
  with check (exists (select 1 from assignments a where a.id = assignment_id and (is_office() or (a.user_id = auth.uid() and a.status = 'submitted'))));
create policy asg_costs_read on assignment_costs for select using (exists (select 1 from assignments a where a.id = assignment_id));
create policy asg_costs_write on assignment_costs for all
  using (exists (select 1 from assignments a where a.id = assignment_id and (is_office() or (a.user_id = auth.uid() and a.status = 'submitted'))))
  with check (exists (select 1 from assignments a where a.id = assignment_id and (is_office() or (a.user_id = auth.uid() and a.status = 'submitted'))));
create policy exc_read on assignment_exceptions for select using (is_office() or user_id = auth.uid());
create policy exc_write on assignment_exceptions for all using (is_owner()) with check (is_owner());
create policy lpj_read on accountabilities for select using (is_office() or exists (select 1 from assignments a where a.id = assignment_id and a.user_id = auth.uid()));
create policy lpj_write on accountabilities for all using (is_office()) with check (is_office());

-- ---------- Pembelian ----------
create policy purch_read on purchases for select using (is_office() or user_id = auth.uid() or is_warehouse());
create policy purch_insert on purchases for insert with check ((is_field() and user_id = auth.uid()) or is_office());
create policy purch_update on purchases for update using (is_office() or (user_id = auth.uid() and status = 'submitted'));
create policy purch_delete on purchases for delete using (is_owner());

create policy weigh_read on purchase_weighings for select using (exists (select 1 from purchases p where p.id = purchase_id));
create policy weigh_write on purchase_weighings for all
  using (exists (select 1 from purchases p where p.id = purchase_id and (is_office() or (p.user_id = auth.uid() and p.status = 'submitted'))))
  with check (exists (select 1 from purchases p where p.id = purchase_id and (is_office() or (p.user_id = auth.uid() and p.status = 'submitted'))));

create policy ppay_read on purchase_payments for select using (is_office() or exists (select 1 from purchases p where p.id = purchase_id and p.user_id = auth.uid()));
create policy ppay_insert on purchase_payments for insert with check (is_office()
  or (user_id = auth.uid() and cash_account_id = field_account_of(auth.uid())
      and exists (select 1 from purchases p where p.id = purchase_id and p.user_id = auth.uid())));
create policy ppay_modify on purchase_payments for update using (is_office());
create policy ppay_delete on purchase_payments for delete using (is_office());

create policy adv_read on advances for select using (is_office() or user_id = auth.uid());
create policy adv_insert on advances for insert with check (is_office()
  or (is_field() and user_id = auth.uid() and cash_account_id = field_account_of(auth.uid())));
create policy adv_update on advances for update using (is_office());
create policy adv_alloc_read on advance_allocations for select using (exists (select 1 from advances a where a.id = advance_id));
create policy adv_alloc_insert on advance_allocations for insert with check (is_office()
  or exists (select 1 from advances a where a.id = advance_id and a.user_id = auth.uid()));
create policy adv_alloc_delete on advance_allocations for delete using (is_office());
create policy adv_ret_read on advance_returns for select using (exists (select 1 from advances a where a.id = advance_id));
create policy adv_ret_insert on advance_returns for insert with check (is_office()
  or (cash_account_id = field_account_of(auth.uid()) and exists (select 1 from advances a where a.id = advance_id and a.user_id = auth.uid())));
create policy adv_ret_delete on advance_returns for delete using (is_office());

-- ---------- Pengeluaran ----------
create policy exp_read on expenses for select using (is_office() or user_id = auth.uid());
create policy exp_insert on expenses for insert with check (is_office()
  or (user_id = auth.uid() and cash_account_id = field_account_of(auth.uid())));
create policy exp_update on expenses for update using (is_office() or (user_id = auth.uid() and status = 'submitted'));

-- ---------- Gudang & produksi ----------
do $$
declare t text;
begin
  foreach t in array array['lots','stock_movements','goods_receipts','stock_opnames','stock_opname_items',
    'stock_adjustments','production_batches','production_inputs','production_costs','goods_dispatches',
    'dispatch_lots','factory_receipts','sales_returns'] loop
    execute format('create policy %I on public.%I for select using (is_office() or is_warehouse())', t || '_read', t);
  end loop;
end $$;

create policy gr_insert on goods_receipts for insert with check (is_office() or is_warehouse());
create policy gr_update on goods_receipts for update using (is_office());
create policy opn_insert on stock_opnames for insert with check (is_office() or is_warehouse());
create policy opn_update on stock_opnames for update using (is_office() or (is_warehouse() and status = 'submitted' and user_id = auth.uid()));
create policy opni_write on stock_opname_items for all
  using (exists (select 1 from stock_opnames o where o.id = opname_id and (is_office() or (o.status = 'submitted' and o.user_id = auth.uid()))))
  with check (exists (select 1 from stock_opnames o where o.id = opname_id and (is_office() or (o.status = 'submitted' and o.user_id = auth.uid()))));
create policy adj_insert on stock_adjustments for insert with check (is_office() or is_warehouse());
create policy adj_update on stock_adjustments for update using (is_office());
create policy batch_insert on production_batches for insert with check (is_office() or is_warehouse());
create policy batch_update on production_batches for update using (is_office() or (is_warehouse() and status = 'running'));
create policy pin_write on production_inputs for all using (is_office() or is_warehouse()) with check (is_office() or is_warehouse());
create policy pcost_write on production_costs for all using (is_office() or is_warehouse()) with check (is_office() or is_warehouse());
create policy disp_insert on goods_dispatches for insert with check (is_office() or is_warehouse());
create policy disp_update on goods_dispatches for update using (is_office() or is_warehouse());
create policy disp_delete on goods_dispatches for delete using (is_office() or (is_warehouse() and user_id = auth.uid() and total_kg = 0));
create policy dlot_insert on dispatch_lots for insert with check (is_office() or is_warehouse());
create policy dlot_delete on dispatch_lots for delete using (is_office());
create policy frcv_insert on factory_receipts for insert with check (is_office() or is_warehouse());
create policy frcv_update on factory_receipts for update using (is_office());
create policy sret_insert on sales_returns for insert with check (is_office() or is_warehouse());

-- ---------- Pabrik, harga, penjualan ----------
create policy fac_read on factories for select using (is_office() or is_warehouse() or my_flag('sell_price'));
create policy fac_write on factories for all using (is_office()) with check (is_office());
create policy fprice_read on factory_prices for select using (is_office() or my_flag('sell_price'));
create policy fprice_write on factory_prices for all using (is_office()) with check (is_office());
create policy so_read on sales_orders for select using (is_office() or is_warehouse());
create policy so_write on sales_orders for all using (is_office()) with check (is_office());
create policy sol_read on sales_order_lots for select using (is_office() or is_warehouse());
create policy sol_write on sales_order_lots for all using (is_office()) with check (is_office());
create policy inv_all on invoices for all using (is_office()) with check (is_office());
create policy invp_all on invoice_payments for all using (is_office()) with check (is_office());

-- ---------- Gaji, bonus, akuntansi ----------
create policy payroll_read on payrolls for select using (my_flag('salary'));
create policy payroll_write on payrolls for all using (is_office() and my_flag('salary')) with check (is_office() and my_flag('salary'));
create policy bonus_read on bonuses for select using (is_office());
create policy bonus_write on bonuses for all using (is_office()) with check (is_office());
create policy je_read on journal_entries for select using (is_office() and my_flag('profit'));
create policy je_delete on journal_entries for delete using (is_owner() and is_manual);
create policy jl_read on journal_lines for select using (is_office() and my_flag('profit'));
create policy period_read on accounting_periods for select using (is_office());
create policy recon_all on bank_reconciliations for all using (is_office()) with check (is_office());

-- Pemakaian fungsi RPC hanya untuk pengguna login
revoke execute on all functions in schema public from anon;
