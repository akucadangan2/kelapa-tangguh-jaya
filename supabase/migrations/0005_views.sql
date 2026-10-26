-- =====================================================================
-- VIEW (security_invoker = true supaya tetap mengikuti RLS pengguna)
-- =====================================================================

-- Saldo per lot: saldo fisik, sudah dipesan, bebas dijual
create or replace view public.v_lot_balance with (security_invoker = true) as
with bal as (
  select lot_id, sum(qty_kg) balance_kg from stock_movements group by lot_id
), reserved as (
  select sol.lot_id, sum(greatest(sol.qty_kg - coalesce((
      select sum(dl.qty_kg) from dispatch_lots dl join goods_dispatches gd on gd.id = dl.dispatch_id
      where gd.sales_order_id = sol.sales_order_id and dl.lot_id = sol.lot_id), 0), 0)) reserved_kg
  from sales_order_lots sol join sales_orders so on so.id = sol.sales_order_id
  where so.status in ('confirmed','shipped')
  group by sol.lot_id
)
select l.*, p.code product_code, p.name product_name, g.name grade_name, w.name warehouse_name, s.name supplier_name,
  coalesce(b.balance_kg, 0) balance_kg,
  coalesce(r.reserved_kg, 0) reserved_kg,
  greatest(coalesce(b.balance_kg, 0) - coalesce(r.reserved_kg, 0), 0) free_kg,
  round(coalesce(b.balance_kg, 0) * l.unit_cost, 2) stock_value
from lots l
join products p on p.id = l.product_id
left join quality_grades g on g.id = l.grade_id
left join warehouses w on w.id = l.warehouse_id
left join suppliers s on s.id = l.supplier_id
left join bal b on b.lot_id = l.id
left join reserved r on r.lot_id = l.id;

-- Barang dalam perjalanan dari petani ke gudang
create or replace view public.v_purchases_in_transit with (security_invoker = true) as
select p.id, p.no, p.purchase_date, p.net_kg, p.agreed_kg, p.goods_status, p.user_id,
  s.name supplier_name, pr.name product_name, pr.code product_code, pf.full_name officer_name
from purchases p
join suppliers s on s.id = p.supplier_id
join products pr on pr.id = p.product_id
join profiles pf on pf.id = p.user_id
where p.status <> 'cancelled' and p.goods_status <> 'received';

-- Stok ringkas per produk & gudang & status
create or replace view public.v_stock_summary with (security_invoker = true) as
select product_id, product_code, product_name, warehouse_id, warehouse_name,
  sum(balance_kg) balance_kg, sum(reserved_kg) reserved_kg, sum(free_kg) free_kg, sum(stock_value) stock_value,
  count(*) filter (where balance_kg > 0) lot_count
from v_lot_balance group by product_id, product_code, product_name, warehouse_id, warehouse_name;

-- Saldo kas/bank
create or replace view public.v_cash_balance with (security_invoker = true) as
select ca.*, pf.full_name owner_name,
  coalesce(sum(case ct.direction when 'in' then ct.amount else -ct.amount end), 0) balance,
  coalesce(sum(ct.amount) filter (where ct.direction = 'in'), 0) total_in,
  coalesce(sum(ct.amount) filter (where ct.direction = 'out'), 0) total_out
from cash_accounts ca
left join profiles pf on pf.id = ca.owner_id
left join cash_transactions ct on ct.account_id = ca.id
group by ca.id, pf.full_name;

-- Harga pabrik terbaru per pabrik & produk, status & estimasi hasil bersih
create or replace view public.v_factory_prices_current with (security_invoker = true) as
select distinct on (fp.factory_id, fp.product_id)
  fp.*, f.name factory_name, f.location factory_location, p.name product_name, p.code product_code,
  pf.full_name updated_by_name,
  case when fp.valid_until is not null and fp.valid_until < now() then 'expired'
       when fp.confirmation = 'indicative' then 'indicative'
       else 'confirmed' end price_status,
  round(fp.price_per_kg * (1 - fp.deduction_pct / 100) - case when fp.delivery_basis = 'franco' then fp.freight_per_kg else 0 end, 2) net_per_kg
from factory_prices fp
join factories f on f.id = fp.factory_id
join products p on p.id = fp.product_id
left join profiles pf on pf.id = fp.updated_by
where f.is_active
order by fp.factory_id, fp.product_id, fp.confirmed_at desc;

-- Status setiap petugas lapangan (untuk dashboard)
create or replace view public.v_field_officers with (security_invoker = true) as
select pf.id user_id, pf.full_name, ca.id cash_account_id,
  coalesce((select sum(case direction when 'in' then amount else -amount end) from cash_transactions where account_id = ca.id), 0) cash_balance,
  a.id assignment_id, a.no assignment_no, a.status assignment_status, a.due_date,
  coalesce((select sum(amount) from cash_transfers where assignment_id = a.id and type = 'disbursement'), 0) + coalesce(a.carry_over_amount, 0) received,
  (select count(*) from advances where user_id = pf.id and status = 'open') open_advances,
  (select coalesce(sum(remaining), 0) from advances where user_id = pf.id and status = 'open') open_advance_amount,
  (select count(*) from purchases where user_id = pf.id and status <> 'cancelled' and goods_status <> 'received') in_transit,
  l.cash_diff, l.status lpj_status
from profiles pf
join user_roles ur on ur.user_id = pf.id and ur.role = 'field'
left join cash_accounts ca on ca.owner_id = pf.id and ca.type = 'field'
left join lateral (select * from assignments x where x.user_id = pf.id and x.status not in ('rejected','cancelled')
                   order by x.created_at desc limit 1) a on true
left join accountabilities l on l.assignment_id = a.id
where pf.is_active;

-- Perbandingan berat: beli -> masuk gudang -> keluar -> diterima pabrik
create or replace view public.v_weight_compare with (security_invoker = true) as
select l.id lot_id, l.code lot_code, pr.name product_name, s.name supplier_name,
  p.no purchase_no, p.purchase_date, p.net_kg purchase_kg, g.received_kg,
  coalesce((select sum(dl.qty_kg) from dispatch_lots dl where dl.lot_id = l.id), 0) dispatched_kg,
  coalesce((select sum(fr.received_kg * dl.qty_kg / nullif(gd.total_kg, 0))
            from dispatch_lots dl join goods_dispatches gd on gd.id = dl.dispatch_id
            join factory_receipts fr on fr.dispatch_id = gd.id where dl.lot_id = l.id), 0) factory_kg
from lots l
join products pr on pr.id = l.product_id
left join suppliers s on s.id = l.supplier_id
left join purchases p on l.source_type = 'purchase' and p.id = l.source_id
left join goods_receipts g on g.lot_id = l.id;

-- Laba per lot (penjualan dialokasikan proporsional berat)
create or replace view public.v_lot_profit with (security_invoker = true) as
select l.id lot_id, l.code lot_code, pr.name product_name, l.initial_kg, l.unit_cost,
  coalesce(sum(dl.qty_kg), 0) sold_kg,
  coalesce(sum(round(dl.qty_kg * dl.unit_cost, 2)), 0) cogs,
  coalesce(sum(round(i.total_amount * dl.qty_kg / nullif(gd.total_kg, 0), 2)), 0) revenue,
  coalesce(sum(round(i.total_amount * dl.qty_kg / nullif(gd.total_kg, 0), 2)), 0) - coalesce(sum(round(dl.qty_kg * dl.unit_cost, 2)), 0) gross_profit
from lots l
join products pr on pr.id = l.product_id
left join dispatch_lots dl on dl.lot_id = l.id
left join goods_dispatches gd on gd.id = dl.dispatch_id
left join invoices i on i.dispatch_id = gd.id and i.status <> 'cancelled'
group by l.id, pr.name;

-- Saldo panjar & utang per pemasok
create or replace view public.v_supplier_balances with (security_invoker = true) as
select s.id supplier_id, s.name supplier_name, s.phone,
  coalesce((select sum(remaining) from advances where supplier_id = s.id and status = 'open'), 0) open_advance,
  coalesce((select sum(balance_due) from purchases where supplier_id = s.id and status <> 'cancelled' and balance_due > 0), 0) payable
from suppliers s;

-- Piutang per pabrik
create or replace view public.v_factory_receivables with (security_invoker = true) as
select f.id factory_id, f.name factory_name,
  coalesce(sum(i.total_amount - i.paid_amount) filter (where i.status in ('unpaid','partial')), 0) receivable,
  min(i.due_date) filter (where i.status in ('unpaid','partial')) nearest_due,
  count(*) filter (where i.status in ('unpaid','partial') and i.due_date < current_date) overdue_count
from factories f left join sales_orders so on so.factory_id = f.id left join invoices i on i.sales_order_id = so.id
group by f.id;

-- Saldo per akun buku besar
create or replace view public.v_account_balances with (security_invoker = true) as
select c.code, c.name, c.type, c.normal,
  coalesce(sum(jl.debit), 0) debit, coalesce(sum(jl.credit), 0) credit,
  case when c.normal = 'debit' then coalesce(sum(jl.debit - jl.credit), 0) else coalesce(sum(jl.credit - jl.debit), 0) end balance
from coa_accounts c left join journal_lines jl on jl.account_code = c.code
group by c.code;
