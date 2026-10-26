-- =====================================================================
-- KOPRA, TEMPURUNG & ARANG — SKEMA DATABASE
-- Dipakai bersama oleh website (Next.js) dan aplikasi Android (Flutter)
-- Semua ID memakai UUID sehingga aplikasi bisa membuat data saat offline.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PENGGUNA & SISTEM
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  is_active boolean not null default true,
  can_view_sell_price boolean not null default false,
  can_view_salary boolean not null default false,
  can_view_profit boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','finance','field','warehouse')),
  primary key (user_id, role)
);

create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text default 'android',
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table public.audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.doc_counters (
  prefix text not null,
  period text not null,
  last_no int not null default 0,
  primary key (prefix, period)
);

-- ---------------------------------------------------------------------
-- MASTER DATA
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- KOPRA, TEMPURUNG, ARANG
  name text not null,
  unit text not null default 'kg',
  min_stock_kg numeric(14,3) not null default 0,
  is_active boolean not null default true
);

create table public.quality_grades (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  name text not null,
  is_active boolean not null default true
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null,
  name text,
  is_active boolean not null default true
);

create table public.coa_accounts (
  code text primary key,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','cogs','expense','other_income')),
  normal text not null check (normal in ('debit','credit')),
  cash_flow_group text check (cash_flow_group in ('operating','investing','financing')),
  is_active boolean not null default true
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  coa_code text not null references public.coa_accounts(code),
  is_active boolean not null default true
);

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('business','bank','field')),
  owner_id uuid references public.profiles(id),     -- diisi untuk kas petugas
  bank_name text,
  account_no text,
  coa_code text not null references public.coa_accounts(code),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index cash_accounts_field_owner on public.cash_accounts(owner_id) where type = 'field';

-- ---------------------------------------------------------------------
-- LAMPIRAN FOTO / BUKTI (dipakai semua modul)
-- ---------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  ref_type text not null,          -- supplier, visit, purchase, advance, expense, goods_receipt, dispatch, factory_receipt, production, opname, adjustment, assignment, lpj, transfer
  ref_id uuid not null,
  kind text not null default 'other', -- goods, scale, receipt, location, arrival, storage, load, delivery_note, factory_scale, factory_receipt, before, after, transfer, other
  storage_path text not null,
  taken_at timestamptz,            -- waktu foto diambil (dari HP)
  received_at timestamptz not null default now(),  -- waktu diterima server
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  source text not null default 'camera' check (source in ('camera','gallery','web')),
  user_id uuid default auth.uid() references public.profiles(id),
  verify_status text not null default 'pending' check (verify_status in ('pending','valid','rejected')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  note text
);
create index attachments_ref on public.attachments(ref_type, ref_id);

-- ---------------------------------------------------------------------
-- PETANI / PEMASOK & KUNJUNGAN
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  directions text,
  vehicle_access text,
  product_codes text[] not null default '{}',
  est_weight_kg numeric(14,3),
  est_sacks int,
  pickup_date date,
  offer_price numeric(14,2),
  max_buy_price numeric(14,2),
  pic_user_id uuid references public.profiles(id),
  notes text,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id),
  client_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_visits (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  visited_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  product_id uuid references public.products(id),
  est_weight_kg numeric(14,3),
  est_sacks int,
  pickup_date date,
  offer_price numeric(14,2),
  notes text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- MODAL PETUGAS (PENUGASAN), PENCAIRAN, PERTANGGUNGJAWABAN
-- ---------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  user_id uuid not null default auth.uid() references public.profiles(id),
  region text,
  purpose text,
  requested_amount numeric(14,2) not null default 0,
  carry_over_amount numeric(14,2) not null default 0,   -- sisa kas sebelumnya yang disetujui dipakai lagi
  approved_amount numeric(14,2),
  due_date date,
  status text not null default 'submitted' check (status in
    ('submitted','approved','rejected','disbursed','active','lpj_submitted','lpj_returned','closed','cancelled')),
  exception_id uuid,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  review_note text,
  received_confirmed_at timestamptz,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  est_weight_kg numeric(14,3),
  plan_price numeric(14,2),
  approved_max_price numeric(14,2)
);

create table public.assignment_costs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  category_id uuid references public.expense_categories(id),
  description text,
  amount numeric(14,2) not null default 0
);

create table public.assignment_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  reason text not null,
  max_amount numeric(14,2) not null,
  due_date date not null,
  approved_by uuid default auth.uid() references public.profiles(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.assignments add constraint assignments_exception_fk
  foreign key (exception_id) references public.assignment_exceptions(id);

create table public.accountabilities (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  total_received numeric(14,2) not null default 0,
  total_used numeric(14,2) not null default 0,
  total_returned numeric(14,2) not null default 0,
  remaining numeric(14,2) not null default 0,
  cash_reported numeric(14,2) not null default 0,     -- uang fisik yang dihitung petugas
  cash_diff numeric(14,2) not null default 0,
  remaining_action text not null default 'return' check (remaining_action in ('return','carry_over')),
  note text,
  status text not null default 'submitted' check (status in ('submitted','returned','approved')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text
);

-- ---------------------------------------------------------------------
-- KAS & BANK
-- ---------------------------------------------------------------------
create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cash_accounts(id),
  trx_date date not null default current_date,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null check (amount > 0),
  ref_type text not null,
  ref_id uuid not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index cash_transactions_acc on public.cash_transactions(account_id, trx_date);
create index cash_transactions_ref on public.cash_transactions(ref_type, ref_id);

create table public.cash_transfers (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  type text not null default 'transfer' check (type in ('transfer','disbursement','return','capital_in','capital_out')),
  from_account_id uuid references public.cash_accounts(id),
  to_account_id uuid references public.cash_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  transfer_date date not null default current_date,
  assignment_id uuid references public.assignments(id),
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_account_id is not null or to_account_id is not null)
);

-- ---------------------------------------------------------------------
-- PEMBELIAN, TIMBANG, PEMBAYARAN, PANJAR
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  purchase_date date not null default current_date,
  supplier_id uuid not null references public.suppliers(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  assignment_id uuid references public.assignments(id),
  product_id uuid not null references public.products(id),
  grade_id uuid references public.quality_grades(id),
  condition text check (condition in ('wet','dry','mixed')),
  moisture_pct numeric(5,2),
  packaging text,
  gross_kg numeric(14,3) not null default 0,
  tare_kg numeric(14,3) not null default 0,
  net_kg numeric(14,3) not null default 0,
  deduction_kg numeric(14,3) not null default 0,
  agreed_kg numeric(14,3) not null default 0,
  price_per_kg numeric(14,2) not null default 0,
  deduction_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  advance_allocated numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  max_price_at_purchase numeric(14,2),
  over_limit boolean not null default false,
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  goods_status text not null default 'in_transit' check (goods_status in ('at_supplier','in_transit','received')),
  status text not null default 'submitted' check (status in ('submitted','verified','cancelled')),
  notes text,
  correction_note text,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);
create index purchases_user on public.purchases(user_id, purchase_date);
create index purchases_assignment on public.purchases(assignment_id);

create table public.purchase_weighings (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  seq int not null,
  sacks int not null default 0,
  gross_kg numeric(14,3) not null default 0,
  tare_kg numeric(14,3) not null default 0,
  net_kg numeric(14,3) generated always as (gross_kg - tare_kg) stored
);

create table public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  cash_account_id uuid not null references public.cash_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  user_id uuid default auth.uid() references public.profiles(id),
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  supplier_id uuid not null references public.suppliers(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  assignment_id uuid references public.assignments(id),
  cash_account_id uuid not null references public.cash_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  given_at date not null default current_date,
  allocated_amount numeric(14,2) not null default 0,
  returned_amount numeric(14,2) not null default 0,
  remaining numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open','settled','cancelled')),
  note text,
  lat double precision,
  lng double precision,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.advance_allocations (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances(id),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table public.advance_returns (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances(id),
  cash_account_id uuid not null references public.cash_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  returned_at date not null default current_date,
  note text,
  user_id uuid default auth.uid() references public.profiles(id),
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GUDANG, LOT, MUTASI STOK
-- ---------------------------------------------------------------------
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  product_id uuid not null references public.products(id),
  grade_id uuid references public.quality_grades(id),
  condition text,
  warehouse_id uuid references public.warehouses(id),
  source_type text not null check (source_type in ('purchase','production','opening')),
  source_id uuid,
  supplier_id uuid references public.suppliers(id),
  initial_kg numeric(14,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  storage_location text,
  is_rework boolean not null default false,
  status text not null default 'available' check (status in ('available','in_production','shipped','closed')),
  created_at timestamptz not null default now()
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id),
  warehouse_id uuid references public.warehouses(id),
  type text not null check (type in ('in','out','production_in','production_out','transfer_in','transfer_out','shrink','damage','opname','return_in')),
  qty_kg numeric(14,3) not null,             -- positif = masuk, negatif = keluar
  unit_cost numeric(14,4) not null default 0,
  ref_type text,
  ref_id uuid,
  moved_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  note text
);
create index stock_movements_lot on public.stock_movements(lot_id);
create index stock_movements_ref on public.stock_movements(ref_type, ref_id);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  purchase_id uuid not null unique references public.purchases(id),
  warehouse_id uuid not null references public.warehouses(id),
  vehicle_id uuid references public.vehicles(id),
  driver_name text,
  received_kg numeric(14,3) not null check (received_kg > 0),
  sacks int,
  grade_id uuid references public.quality_grades(id),
  condition text,
  storage_location text,
  diff_kg numeric(14,3) not null default 0,
  lot_id uuid references public.lots(id),
  received_by uuid default auth.uid() references public.profiles(id),
  received_at timestamptz not null default now(),
  note text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stock_opnames (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  warehouse_id uuid not null references public.warehouses(id),
  opname_date date not null default current_date,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  note text,
  user_id uuid default auth.uid() references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.stock_opname_items (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid not null references public.stock_opnames(id) on delete cascade,
  lot_id uuid not null references public.lots(id),
  system_kg numeric(14,3) not null,
  counted_kg numeric(14,3) not null,
  diff_kg numeric(14,3) generated always as (counted_kg - system_kg) stored,
  reason text
);

create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  lot_id uuid not null references public.lots(id),
  type text not null check (type in ('shrink','damage','transfer')),
  qty_kg numeric(14,3) not null check (qty_kg > 0),
  to_warehouse_id uuid references public.warehouses(id),
  reason text not null,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  user_id uuid default auth.uid() references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUKSI ARANG
-- ---------------------------------------------------------------------
create table public.production_batches (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  batch_date date not null default current_date,
  kiln text,
  warehouse_id uuid not null references public.warehouses(id),
  operator_name text,
  status text not null default 'running' check (status in ('running','done','cancelled')),
  weight_basis text not null default 'dry' check (weight_basis in ('dry','wet')),
  input_kg numeric(14,3) not null default 0,
  input_cost numeric(14,2) not null default 0,
  other_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  output_good_kg numeric(14,3) not null default 0,
  output_rework_kg numeric(14,3) not null default 0,
  loss_kg numeric(14,3) not null default 0,
  yield_pct numeric(7,2),
  hpp_per_kg numeric(14,2),
  output_lot_id uuid references public.lots(id),
  rework_lot_id uuid references public.lots(id),
  grade_id uuid references public.quality_grades(id),
  user_id uuid default auth.uid() references public.profiles(id),
  finished_at timestamptz,
  note text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.production_inputs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  lot_id uuid not null references public.lots(id),
  qty_kg numeric(14,3) not null check (qty_kg > 0),
  unit_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.production_costs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  type text not null check (type in ('labor','fuel','other')),
  amount numeric(14,2) not null check (amount > 0),
  cash_account_id uuid references public.cash_accounts(id),
  note text,
  cost_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PABRIK, HARGA, PENJUALAN, PENGIRIMAN, TAGIHAN
-- ---------------------------------------------------------------------
create table public.factories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  lat double precision,
  lng double precision,
  contact_name text,
  phone text,
  product_codes text[] not null default '{}',
  quality_spec text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.factory_prices (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id),
  product_id uuid not null references public.products(id),
  price_per_kg numeric(14,2) not null,
  delivery_basis text not null default 'franco' check (delivery_basis in ('franco','loco')),
  freight_per_kg numeric(14,2) not null default 0,
  deduction_pct numeric(5,2) not null default 0,
  deduction_note text,
  payment_term_days int not null default 0,
  conditions text,
  confirmation text not null default 'confirmed' check (confirmation in ('confirmed','indicative')),
  source text,
  confirmed_at timestamptz not null default now(),
  valid_until timestamptz,
  updated_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  order_date date not null default current_date,
  factory_id uuid not null references public.factories(id),
  product_id uuid not null references public.products(id),
  factory_price_id uuid references public.factory_prices(id),
  price_per_kg numeric(14,2) not null,
  order_kg numeric(14,3) not null,
  delivery_basis text,
  status text not null default 'confirmed' check (status in ('confirmed','shipped','received','invoiced','closed','cancelled')),
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.sales_order_lots (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  lot_id uuid not null references public.lots(id),
  qty_kg numeric(14,3) not null check (qty_kg > 0)
);

create table public.goods_dispatches (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  sales_order_id uuid not null references public.sales_orders(id),
  warehouse_id uuid not null references public.warehouses(id),
  vehicle_id uuid references public.vehicles(id),
  driver_name text,
  delivery_note_no text,
  dispatched_at timestamptz not null default now(),
  total_kg numeric(14,3) not null default 0,
  cost_amount numeric(14,2) not null default 0,
  freight_cost numeric(14,2) not null default 0,
  status text not null default 'in_transit' check (status in ('in_transit','received','returned','partial')),
  user_id uuid default auth.uid() references public.profiles(id),
  note text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.dispatch_lots (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.goods_dispatches(id) on delete cascade,
  lot_id uuid not null references public.lots(id),
  qty_kg numeric(14,3) not null check (qty_kg > 0),
  unit_cost numeric(14,4) not null default 0
);

create table public.factory_receipts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null unique references public.goods_dispatches(id),
  received_kg numeric(14,3) not null,
  quality_note text,
  deduction_kg numeric(14,3) not null default 0,
  deduction_amount numeric(14,2) not null default 0,
  receiver_name text,
  received_at timestamptz not null default now(),
  diff_kg numeric(14,3) not null default 0,
  user_id uuid default auth.uid() references public.profiles(id),
  note text,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  dispatch_id uuid not null references public.goods_dispatches(id),
  lot_id uuid not null references public.lots(id),
  qty_kg numeric(14,3) not null check (qty_kg > 0),
  action text not null check (action in ('return_to_warehouse','redirect','pending')),
  warehouse_id uuid references public.warehouses(id),
  note text,
  user_id uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  sales_order_id uuid not null references public.sales_orders(id),
  dispatch_id uuid not null unique references public.goods_dispatches(id),
  invoice_date date not null default current_date,
  due_date date,
  accepted_kg numeric(14,3) not null,
  price_per_kg numeric(14,2) not null,
  deduction_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  cogs_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','cancelled')),
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  cash_account_id uuid not null references public.cash_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PENGELUARAN, GAJI, BONUS
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  expense_date date not null default current_date,
  category_id uuid not null references public.expense_categories(id),
  payee text,
  amount numeric(14,2) not null check (amount > 0),
  description text,
  cash_account_id uuid not null references public.cash_accounts(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  assignment_id uuid references public.assignments(id),
  vehicle_id uuid references public.vehicles(id),
  trip_note text,
  liters numeric(10,2),
  purchase_id uuid references public.purchases(id),
  dispatch_id uuid references public.goods_dispatches(id),
  people_count int,
  status text not null default 'submitted' check (status in ('submitted','valid','rejected','cancelled')),
  review_note text,
  lat double precision,
  lng double precision,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payrolls (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  employee_id uuid references public.profiles(id),
  employee_name text not null,
  period text not null,                 -- contoh 2026-10
  gross_amount numeric(14,2) not null,
  deductions numeric(14,2) not null default 0,
  net_amount numeric(14,2) generated always as (gross_amount - deductions) stored,
  paid_at date not null default current_date,
  cash_account_id uuid not null references public.cash_accounts(id),
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bonuses (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  recipient_id uuid references public.profiles(id),
  recipient_name text not null,
  reason text not null,
  period text,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  cash_account_id uuid not null references public.cash_accounts(id),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AKUNTANSI
-- ---------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  entry_date date not null,
  description text,
  ref_type text,
  ref_id uuid,
  is_manual boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index journal_entries_ref on public.journal_entries(ref_type, ref_id);
create index journal_entries_date on public.journal_entries(entry_date);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null references public.coa_accounts(code),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  cash_account_id uuid references public.cash_accounts(id),
  memo text
);
create index journal_lines_acc on public.journal_lines(account_code);

create table public.accounting_periods (
  period text primary key,               -- YYYY-MM
  closed_at timestamptz,
  closed_by uuid references public.profiles(id)
);

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.cash_accounts(id),
  period_end date not null,
  statement_balance numeric(14,2) not null,
  system_balance numeric(14,2) not null,
  diff numeric(14,2) generated always as (statement_balance - system_balance) stored,
  note text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
