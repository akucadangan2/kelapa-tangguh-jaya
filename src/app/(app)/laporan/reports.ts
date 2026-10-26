import type { Session } from "@/lib/auth";
import type { FilterDef } from "@/components/filter-bar";

export type Fmt = "rp" | "kg" | "pct" | "date" | "text" | "num";
export type RCol = { key: string; label: string; fmt?: Fmt };
export type Section = { title?: string; cols: RCol[]; rows: any[]; total?: Record<string, any> };
export type Built = { stats?: { label: string; value: any; fmt?: Fmt }[]; sections: Section[] };
type Opt = Record<string, { value: string; label: string }[]>;

export type Report = {
  slug: string;
  title: string;
  desc: string;
  href?: string;
  allowed: (s: Session) => boolean;
  options?: string[];
  filters?: (o: Opt) => FilterDef[];
  build?: (sb: any, f: Record<string, string>, s: Session) => Promise<Built>;
};

const office = (s: Session) => s.isOffice;
const officeProfit = (s: Session) => s.isOffice && s.canProfit;
const whOrOffice = (s: Session) => s.isOffice || s.isWarehouse;
const sum = (rows: any[], k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
const end = (d: string) => d + "T23:59:59+07:00";

function groupSum(rows: any[], key: string, fields: string[]) {
  const m = new Map<string, any>();
  rows.forEach((r) => {
    const g = m.get(r[key]) ?? { [key]: r[key], count: 0, ...Object.fromEntries(fields.map((f) => [f, 0])) };
    g.count++;
    fields.forEach((f) => (g[f] += Number(r[f] ?? 0)));
    m.set(r[key], g);
  });
  return [...m.values()];
}

export const REPORTS: Report[] = [
  {
    slug: "pembelian", title: "Pembelian", desc: "Petani, barang, berat, harga beli, panjar dan pembayaran", allowed: office,
    options: ["officers", "suppliers", "products"],
    filters: (o) => [
      { name: "user", label: "Petugas", type: "select", options: o.officers },
      { name: "supplier", label: "Petani", type: "select", options: o.suppliers },
      { name: "product", label: "Produk", type: "select", options: o.products },
    ],
    build: async (sb, f) => {
      let q = sb.from("purchases").select("*, suppliers(name), products(name), quality_grades(name), profiles:user_id(full_name)")
        .neq("status", "cancelled").gte("purchase_date", f.from).lte("purchase_date", f.to).order("purchase_date");
      if (f.user) q = q.eq("user_id", f.user);
      if (f.supplier) q = q.eq("supplier_id", f.supplier);
      if (f.product) q = q.eq("product_id", f.product);
      const rows = ((await q).data ?? []).map((r: any) => ({
        no: r.no, date: r.purchase_date, officer: r.profiles?.full_name, supplier: r.suppliers?.name, product: r.products?.name, grade: r.quality_grades?.name,
        kg: r.agreed_kg, price: r.price_per_kg, deduction: r.deduction_amount, total: r.total_amount, advance: r.advance_allocated, paid: r.paid_amount, due: r.balance_due,
      }));
      const byProd = groupSum(rows, "product", ["kg", "total"]).map((g) => ({ ...g, avg: g.kg ? g.total / g.kg : 0 }));
      return {
        stats: [{ label: "Transaksi", value: rows.length, fmt: "num" }, { label: "Berat", value: sum(rows, "kg"), fmt: "kg" }, { label: "Nilai", value: sum(rows, "total"), fmt: "rp" }, { label: "Sisa utang", value: sum(rows, "due"), fmt: "rp" }],
        sections: [
          { title: "Ringkasan per produk", cols: [{ key: "product", label: "Produk" }, { key: "count", label: "Transaksi", fmt: "num" }, { key: "kg", label: "Berat", fmt: "kg" }, { key: "total", label: "Nilai", fmt: "rp" }, { key: "avg", label: "Rata-rata/kg", fmt: "rp" }], rows: byProd },
          {
            title: "Rincian", rows,
            cols: [{ key: "no", label: "No" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "officer", label: "Petugas" }, { key: "supplier", label: "Petani" }, { key: "product", label: "Produk" }, { key: "grade", label: "Mutu" },
              { key: "kg", label: "Berat", fmt: "kg" }, { key: "price", label: "Harga/kg", fmt: "rp" }, { key: "deduction", label: "Potongan", fmt: "rp" }, { key: "total", label: "Total", fmt: "rp" },
              { key: "advance", label: "Panjar", fmt: "rp" }, { key: "paid", label: "Dibayar", fmt: "rp" }, { key: "due", label: "Sisa", fmt: "rp" }],
            total: { no: "Total", kg: sum(rows, "kg"), total: sum(rows, "total"), advance: sum(rows, "advance"), paid: sum(rows, "paid"), due: sum(rows, "due") },
          },
        ],
      };
    },
  },
  {
    slug: "penjualan", title: "Penjualan", desc: "Pabrik, berat, harga jual, potongan dan pembayaran", allowed: office,
    options: ["factories", "products"],
    filters: (o) => [{ name: "factory", label: "Pabrik", type: "select", options: o.factories }, { name: "product", label: "Produk", type: "select", options: o.products }],
    build: async (sb, f, s) => {
      let q = sb.from("invoices").select("*, sales_orders!inner(no, factory_id, product_id, factories(name), products(name))")
        .neq("status", "cancelled").gte("invoice_date", f.from).lte("invoice_date", f.to).order("invoice_date");
      if (f.factory) q = q.eq("sales_orders.factory_id", f.factory);
      if (f.product) q = q.eq("sales_orders.product_id", f.product);
      const rows = ((await q).data ?? []).map((r: any) => ({
        no: r.no, order: r.sales_orders?.no, date: r.invoice_date, factory: r.sales_orders?.factories?.name, product: r.sales_orders?.products?.name,
        kg: r.accepted_kg, price: r.price_per_kg, deduction: r.deduction_amount, total: r.total_amount, cogs: r.cogs_amount, gross: Number(r.total_amount) - Number(r.cogs_amount),
        paid: r.paid_amount, due: Number(r.total_amount) - Number(r.paid_amount), due_date: r.due_date,
      }));
      const profitCols: RCol[] = s.canProfit ? [{ key: "cogs", label: "HPP", fmt: "rp" }, { key: "gross", label: "Laba kotor", fmt: "rp" }] : [];
      return {
        stats: [{ label: "Berat terjual", value: sum(rows, "kg"), fmt: "kg" }, { label: "Penjualan", value: sum(rows, "total"), fmt: "rp" }, { label: "Diterima", value: sum(rows, "paid"), fmt: "rp" }, { label: "Piutang", value: sum(rows, "due"), fmt: "rp" }],
        sections: [
          { title: "Per pabrik", cols: [{ key: "factory", label: "Pabrik" }, { key: "count", label: "Tagihan", fmt: "num" }, { key: "kg", label: "Berat", fmt: "kg" }, { key: "total", label: "Penjualan", fmt: "rp" }, ...(s.canProfit ? [{ key: "gross", label: "Laba kotor", fmt: "rp" as Fmt }] : []), { key: "due", label: "Piutang", fmt: "rp" }], rows: groupSum(rows, "factory", ["kg", "total", "gross", "due"]) },
          {
            title: "Rincian", rows,
            cols: [{ key: "no", label: "Tagihan" }, { key: "order", label: "Pesanan" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "factory", label: "Pabrik" }, { key: "product", label: "Produk" },
              { key: "kg", label: "Berat", fmt: "kg" }, { key: "price", label: "Harga/kg", fmt: "rp" }, { key: "deduction", label: "Potongan", fmt: "rp" }, { key: "total", label: "Total", fmt: "rp" }, ...profitCols,
              { key: "paid", label: "Dibayar", fmt: "rp" }, { key: "due", label: "Sisa", fmt: "rp" }, { key: "due_date", label: "Jatuh tempo", fmt: "date" }],
            total: { no: "Total", kg: sum(rows, "kg"), total: sum(rows, "total"), cogs: sum(rows, "cogs"), gross: sum(rows, "gross"), paid: sum(rows, "paid"), due: sum(rows, "due") },
          },
        ],
      };
    },
  },
  { slug: "foto", title: "Foto Kegiatan", desc: "Pembelian, masuk/keluar gudang, produksi dan penerimaan pabrik", allowed: whOrOffice, href: "/gudang/laporan-foto" },
  {
    slug: "stok", title: "Stok & Mutasi", desc: "Saldo awal, masuk, keluar, saldo akhir dan nilai per produk & gudang", allowed: whOrOffice,
    options: ["products", "warehouses"],
    filters: (o) => [{ name: "product", label: "Produk", type: "select", options: o.products }, { name: "warehouse", label: "Gudang", type: "select", options: o.warehouses }],
    build: async (sb, f, s) => {
      let q = sb.from("stock_movements").select("qty_kg, unit_cost, moved_at, type, warehouse_id, lots!inner(product_id, unit_cost, products(name)), warehouses(name)").lte("moved_at", end(f.to)).limit(50000);
      if (f.product) q = q.eq("lots.product_id", f.product);
      if (f.warehouse) q = q.eq("warehouse_id", f.warehouse);
      const mv = (await q).data ?? [];
      const m = new Map<string, any>();
      const startTs = new Date(f.from + "T00:00:00+07:00").getTime();
      mv.forEach((x: any) => {
        const key = `${x.lots?.products?.name}|${x.warehouses?.name ?? "-"}`;
        const g = m.get(key) ?? { product: x.lots?.products?.name, warehouse: x.warehouses?.name ?? "-", opening: 0, in: 0, out: 0, closing: 0, value: 0 };
        const qty = Number(x.qty_kg);
        if (new Date(x.moved_at).getTime() < startTs) g.opening += qty;
        else if (qty > 0) g.in += qty;
        else g.out += -qty;
        g.closing += qty;
        g.value += qty * Number(x.lots?.unit_cost ?? 0);
        m.set(key, g);
      });
      const rows = [...m.values()];
      const cols: RCol[] = [{ key: "product", label: "Produk" }, { key: "warehouse", label: "Gudang" }, { key: "opening", label: "Saldo awal", fmt: "kg" }, { key: "in", label: "Masuk", fmt: "kg" }, { key: "out", label: "Keluar", fmt: "kg" }, { key: "closing", label: "Saldo akhir", fmt: "kg" }];
      if (s.isOffice) cols.push({ key: "value", label: "Nilai", fmt: "rp" });
      const byType = new Map<string, number>();
      mv.filter((x: any) => new Date(x.moved_at).getTime() >= startTs).forEach((x: any) => byType.set(x.type, (byType.get(x.type) ?? 0) + Number(x.qty_kg)));
      const TYPES: Record<string, string> = { in: "Masuk dari pembelian", out: "Keluar penjualan", production_in: "Hasil produksi", production_out: "Dipakai produksi", transfer_in: "Pindahan masuk", transfer_out: "Pindahan keluar", shrink: "Susut", damage: "Rusak", opname: "Selisih opname", return_in: "Retur" };
      return {
        sections: [
          { title: "Ringkasan stok", cols, rows, total: { product: "Total", opening: sum(rows, "opening"), in: sum(rows, "in"), out: sum(rows, "out"), closing: sum(rows, "closing"), value: sum(rows, "value") } },
          { title: "Mutasi per jenis (periode)", cols: [{ key: "type", label: "Jenis" }, { key: "kg", label: "Berat", fmt: "kg" }], rows: [...byType.entries()].map(([t, v]) => ({ type: TYPES[t] ?? t, kg: v })) },
        ],
      };
    },
  },
  {
    slug: "produksi", title: "Produksi Arang", desc: "Bahan terpakai, hasil, rendemen dan HPP", allowed: whOrOffice,
    build: async (sb, f, s) => {
      const rows = ((await sb.from("production_batches").select("*").eq("status", "done").gte("batch_date", f.from).lte("batch_date", f.to).order("batch_date")).data ?? [])
        .map((b: any) => ({ no: b.no, date: b.batch_date, kiln: b.kiln, operator: b.operator_name, input: b.input_kg, good: b.output_good_kg, rework: b.output_rework_kg, loss: b.loss_kg, yield: b.yield_pct, cost: b.total_cost, hpp: b.hpp_per_kg }));
      const inp = sum(rows, "input"), good = sum(rows, "good"), cost = sum(rows, "cost");
      return {
        stats: [{ label: "Tempurung terpakai", value: inp, fmt: "kg" }, { label: "Arang layak", value: good, fmt: "kg" }, { label: "Rendemen", value: inp ? (good / inp) * 100 : 0, fmt: "pct" }, ...(s.isOffice ? [{ label: "HPP rata-rata/kg", value: good ? cost / good : 0, fmt: "rp" as Fmt }] : [])],
        sections: [
          { title: "Per tungku", cols: [{ key: "kiln", label: "Tungku" }, { key: "count", label: "Batch", fmt: "num" }, { key: "input", label: "Tempurung", fmt: "kg" }, { key: "good", label: "Arang layak", fmt: "kg" }, { key: "yield", label: "Rendemen", fmt: "pct" }],
            rows: groupSum(rows, "kiln", ["input", "good"]).map((g) => ({ ...g, yield: g.input ? (g.good / g.input) * 100 : 0 })) },
          {
            title: "Rincian batch", rows,
            cols: [{ key: "no", label: "No" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "kiln", label: "Tungku" }, { key: "operator", label: "Operator" }, { key: "input", label: "Tempurung", fmt: "kg" }, { key: "good", label: "Arang layak", fmt: "kg" },
              { key: "rework", label: "Proses ulang", fmt: "kg" }, { key: "loss", label: "Susut", fmt: "kg" }, { key: "yield", label: "Rendemen", fmt: "pct" }, ...(s.isOffice ? [{ key: "cost", label: "Biaya", fmt: "rp" as Fmt }, { key: "hpp", label: "HPP/kg", fmt: "rp" as Fmt }] : [])],
            total: { no: "Total", input: inp, good, rework: sum(rows, "rework"), loss: sum(rows, "loss"), cost },
          },
        ],
      };
    },
  },
  {
    slug: "pengeluaran", title: "Pengeluaran", desc: "Gaji, BBM, perbaikan, makan, bonus dan biaya lainnya", allowed: office,
    options: ["categories", "officers"],
    filters: (o) => [{ name: "category", label: "Kategori", type: "select", options: o.categories }, { name: "user", label: "Petugas", type: "select", options: o.officers }],
    build: async (sb, f, s) => {
      let q = sb.from("expenses").select("*, expense_categories(name), cash_accounts(name), profiles:user_id(full_name), vehicles(plate_no)").neq("status", "cancelled").gte("expense_date", f.from).lte("expense_date", f.to).order("expense_date");
      if (f.category) q = q.eq("category_id", f.category);
      if (f.user) q = q.eq("user_id", f.user);
      const exp = ((await q).data ?? []).map((e: any) => ({ no: e.no, date: e.expense_date, category: e.expense_categories?.name, desc: [e.description, e.vehicles?.plate_no, e.liters ? `${e.liters} L` : null].filter(Boolean).join(" · "), by: e.profiles?.full_name, source: e.cash_accounts?.name, amount: e.amount, status: e.status }));
      const extra: any[] = [];
      if (!f.category && !f.user) {
        if (s.canSalary) ((await sb.from("payrolls").select("*").gte("paid_at", f.from).lte("paid_at", f.to)).data ?? []).forEach((p: any) => extra.push({ no: p.no, date: p.paid_at, category: "Gaji", desc: `${p.employee_name} ${p.period}`, amount: p.net_amount }));
        ((await sb.from("bonuses").select("*").gte("paid_at", f.from).lte("paid_at", f.to)).data ?? []).forEach((b: any) => extra.push({ no: b.no, date: b.paid_at, category: "Bonus", desc: `${b.recipient_name} - ${b.reason}`, amount: b.amount }));
      }
      const rows = [...exp, ...extra].sort((a, b) => (a.date < b.date ? -1 : 1));
      return {
        stats: [{ label: "Total biaya", value: sum(rows, "amount"), fmt: "rp" }],
        sections: [
          { title: "Per kategori", cols: [{ key: "category", label: "Kategori" }, { key: "count", label: "Transaksi", fmt: "num" }, { key: "amount", label: "Total", fmt: "rp" }], rows: groupSum(rows, "category", ["amount"]).sort((a, b) => b.amount - a.amount), total: { category: "Total", amount: sum(rows, "amount") } },
          { title: "Rincian", rows, cols: [{ key: "no", label: "No" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "category", label: "Kategori" }, { key: "desc", label: "Keterangan" }, { key: "by", label: "Oleh" }, { key: "source", label: "Sumber" }, { key: "amount", label: "Nominal", fmt: "rp" }], total: { no: "Total", amount: sum(rows, "amount") } },
        ],
      };
    },
  },
  {
    slug: "kas-petugas", title: "Modal & Kas Petugas", desc: "Dana diterima, penggunaan, bukti, saldo, selisih dan persetujuan", allowed: office,
    options: ["officers"],
    filters: (o) => [{ name: "user", label: "Petugas", type: "select", options: o.officers }],
    build: async (sb, f) => {
      let q = sb.from("assignments").select("id, no, status, created_at, due_date, profiles:user_id(full_name), accountabilities(cash_reported, cash_diff, status)")
        .not("status", "in", "(rejected,cancelled)").gte("created_at", f.from).lte("created_at", end(f.to)).order("created_at");
      if (f.user) q = q.eq("user_id", f.user);
      const list = (await q).data ?? [];
      const rows = await Promise.all(list.map(async (a: any) => {
        const sm: any = (await sb.rpc("assignment_summary", { p_id: a.id })).data ?? {};
        const miss = ((await sb.rpc("assignment_missing_proofs", { p_id: a.id })).data ?? []).length;
        const l = Array.isArray(a.accountabilities) ? a.accountabilities[0] : a.accountabilities;
        return { no: a.no, date: a.created_at, officer: a.profiles?.full_name, status: a.status, received: sm.received, purchases: sm.purchase_paid, advances: sm.advances, expenses: sm.expenses, used: sm.used, returned: sm.returned, remaining: sm.remaining, reported: l?.cash_reported, diff: l?.cash_diff, missing: miss, due: a.due_date };
      }));
      const STAT: Record<string, string> = { submitted: "Diajukan", approved: "Disetujui", disbursed: "Dicairkan", active: "Berjalan", lpj_submitted: "LPJ diperiksa", lpj_returned: "LPJ dikembalikan", closed: "Selesai" };
      return {
        stats: [{ label: "Modal diterima", value: sum(rows, "received"), fmt: "rp" }, { label: "Penggunaan", value: sum(rows, "used"), fmt: "rp" }, { label: "Sisa kas", value: sum(rows, "remaining"), fmt: "rp" }],
        sections: [{
          rows: rows.map((r) => ({ ...r, status: STAT[r.status] ?? r.status })),
          cols: [{ key: "no", label: "No" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "officer", label: "Petugas" }, { key: "status", label: "Status" }, { key: "received", label: "Diterima", fmt: "rp" },
            { key: "purchases", label: "Pembelian", fmt: "rp" }, { key: "advances", label: "Panjar", fmt: "rp" }, { key: "expenses", label: "Biaya", fmt: "rp" }, { key: "used", label: "Penggunaan", fmt: "rp" },
            { key: "returned", label: "Disetor", fmt: "rp" }, { key: "remaining", label: "Sisa", fmt: "rp" }, { key: "reported", label: "Uang fisik", fmt: "rp" }, { key: "diff", label: "Selisih", fmt: "rp" }, { key: "missing", label: "Bukti kurang", fmt: "num" }, { key: "due", label: "Tenggat", fmt: "date" }],
          total: { no: "Total", received: sum(rows, "received"), purchases: sum(rows, "purchases"), advances: sum(rows, "advances"), expenses: sum(rows, "expenses"), used: sum(rows, "used"), returned: sum(rows, "returned"), remaining: sum(rows, "remaining") },
        }],
      };
    },
  },
  {
    slug: "panjar-utang-piutang", title: "Panjar, Utang & Piutang", desc: "Saldo per petani/pabrik, penyelesaian dan jatuh tempo", allowed: office,
    build: async (sb) => {
      const [sup, adv, fac, inv] = await Promise.all([
        sb.from("v_supplier_balances").select("*").or("open_advance.gt.0,payable.gt.0").order("supplier_name"),
        sb.from("advances").select("*, suppliers(name), profiles:user_id(full_name)").eq("status", "open").order("given_at"),
        sb.from("v_factory_receivables").select("*").gt("receivable", 0),
        sb.from("invoices").select("*, sales_orders(factories(name))").in("status", ["unpaid", "partial"]).order("due_date"),
      ]);
      const s1 = (sup.data ?? []).map((r: any) => ({ supplier: r.supplier_name, phone: r.phone, advance: r.open_advance, payable: r.payable }));
      const s2 = (adv.data ?? []).map((a: any) => ({ no: a.no, date: a.given_at, supplier: a.suppliers?.name, officer: a.profiles?.full_name, amount: a.amount, allocated: a.allocated_amount, returned: a.returned_amount, remaining: a.remaining }));
      const s3 = (inv.data ?? []).map((i: any) => ({ no: i.no, factory: i.sales_orders?.factories?.name, date: i.invoice_date, due_date: i.due_date, total: i.total_amount, paid: i.paid_amount, due: Number(i.total_amount) - Number(i.paid_amount) }));
      return {
        stats: [{ label: "Panjar terbuka", value: sum(s1, "advance"), fmt: "rp" }, { label: "Utang ke petani", value: sum(s1, "payable"), fmt: "rp" }, { label: "Piutang pabrik", value: sum(fac.data ?? [], "receivable"), fmt: "rp" }],
        sections: [
          { title: "Saldo per petani", rows: s1, cols: [{ key: "supplier", label: "Petani" }, { key: "phone", label: "HP" }, { key: "advance", label: "Panjar terbuka", fmt: "rp" }, { key: "payable", label: "Utang", fmt: "rp" }], total: { supplier: "Total", advance: sum(s1, "advance"), payable: sum(s1, "payable") } },
          { title: "Panjar terbuka", rows: s2, cols: [{ key: "no", label: "No" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "supplier", label: "Petani" }, { key: "officer", label: "Petugas" }, { key: "amount", label: "Nominal", fmt: "rp" }, { key: "allocated", label: "Dipotong", fmt: "rp" }, { key: "returned", label: "Kembali", fmt: "rp" }, { key: "remaining", label: "Sisa", fmt: "rp" }] },
          { title: "Piutang per tagihan", rows: s3, cols: [{ key: "no", label: "Tagihan" }, { key: "factory", label: "Pabrik" }, { key: "date", label: "Tanggal", fmt: "date" }, { key: "due_date", label: "Jatuh tempo", fmt: "date" }, { key: "total", label: "Total", fmt: "rp" }, { key: "paid", label: "Dibayar", fmt: "rp" }, { key: "due", label: "Sisa", fmt: "rp" }], total: { no: "Total", total: sum(s3, "total"), paid: sum(s3, "paid"), due: sum(s3, "due") } },
        ],
      };
    },
  },
  {
    slug: "kas-bank", title: "Kas & Bank", desc: "Saldo awal, penerimaan, pengeluaran dan saldo akhir per akun", allowed: office,
    build: async (sb, f) => {
      const [{ data: accs }, { data: trx }] = await Promise.all([
        sb.from("cash_accounts").select("id, name, type").eq("is_active", true).order("type").order("name"),
        sb.from("cash_transactions").select("account_id, trx_date, direction, amount").lte("trx_date", f.to).limit(100000),
      ]);
      const rows = (accs ?? []).map((a: any) => {
        const t = (trx ?? []).filter((x: any) => x.account_id === a.id);
        const sg = (x: any) => (x.direction === "in" ? 1 : -1) * Number(x.amount);
        const opening = t.filter((x: any) => x.trx_date < f.from).reduce((s: number, x: any) => s + sg(x), 0);
        const tin = t.filter((x: any) => x.trx_date >= f.from && x.direction === "in").reduce((s: number, x: any) => s + Number(x.amount), 0);
        const tout = t.filter((x: any) => x.trx_date >= f.from && x.direction === "out").reduce((s: number, x: any) => s + Number(x.amount), 0);
        return { name: a.name, type: a.type === "business" ? "Kas usaha" : a.type === "bank" ? "Bank" : "Kas petugas", opening, in: tin, out: tout, closing: opening + tin - tout };
      });
      return {
        sections: [{ rows, cols: [{ key: "name", label: "Akun" }, { key: "type", label: "Jenis" }, { key: "opening", label: "Saldo awal", fmt: "rp" }, { key: "in", label: "Penerimaan", fmt: "rp" }, { key: "out", label: "Pengeluaran", fmt: "rp" }, { key: "closing", label: "Saldo akhir", fmt: "rp" }],
          total: { name: "Total", opening: sum(rows, "opening"), in: sum(rows, "in"), out: sum(rows, "out"), closing: sum(rows, "closing") } }],
      };
    },
  },
  {
    slug: "laba-rugi", title: "Laba Rugi", desc: "Penjualan, HPP, laba kotor, biaya operasional dan laba bersih", allowed: officeProfit,
    build: async (sb, f) => {
      const { data } = await sb.from("journal_lines").select("account_code, debit, credit, coa_accounts!inner(name, type), journal_entries!inner(entry_date)")
        .gte("journal_entries.entry_date", f.from).lte("journal_entries.entry_date", f.to).in("coa_accounts.type", ["revenue", "other_income", "cogs", "expense"]).limit(100000);
      const m = new Map<string, any>();
      (data ?? []).forEach((l: any) => {
        const t = l.coa_accounts.type;
        const v = t === "revenue" || t === "other_income" ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
        const g = m.get(l.account_code) ?? { code: l.account_code, name: l.coa_accounts.name, type: t, amount: 0 };
        g.amount += v;
        m.set(l.account_code, g);
      });
      const by = (t: string) => [...m.values()].filter((x) => x.type === t).sort((a, b) => a.code.localeCompare(b.code));
      const rev = sum(by("revenue"), "amount"), oth = sum(by("other_income"), "amount"), cogs = sum(by("cogs"), "amount"), exp = sum(by("expense"), "amount");
      const line = (label: string, amount: number | null, bold = false) => ({ label: bold ? label.toUpperCase() : label, amount });
      const rows = [
        line("Pendapatan", null, true), ...by("revenue").map((x) => line(`   ${x.code} ${x.name}`, x.amount)), line("Total penjualan", rev),
        line("Harga pokok penjualan", null, true), ...by("cogs").map((x) => line(`   ${x.code} ${x.name}`, x.amount)), line("Total HPP", cogs),
        line("Laba kotor", rev - cogs, true),
        line("Biaya operasional", null, true), ...by("expense").map((x) => line(`   ${x.code} ${x.name}`, x.amount)), line("Total biaya operasional", exp),
        ...(oth ? [line("Pendapatan lain-lain", oth)] : []),
        line("Laba bersih", rev - cogs - exp + oth, true),
      ];
      return {
        stats: [{ label: "Penjualan", value: rev, fmt: "rp" }, { label: "Laba kotor", value: rev - cogs, fmt: "rp" }, { label: "Biaya operasional", value: exp, fmt: "rp" }, { label: "Laba bersih", value: rev - cogs - exp + oth, fmt: "rp" }],
        sections: [{ rows, cols: [{ key: "label", label: "Uraian" }, { key: "amount", label: "Jumlah", fmt: "rp" }] }],
      };
    },
  },
  {
    slug: "neraca", title: "Neraca", desc: "Aset, kewajiban dan modal per tanggal", allowed: officeProfit,
    build: async (sb, f) => {
      const { data } = await sb.from("journal_lines").select("account_code, debit, credit, coa_accounts!inner(name, type, normal), journal_entries!inner(entry_date)")
        .lte("journal_entries.entry_date", f.to).limit(200000);
      const m = new Map<string, any>();
      let earnings = 0;
      (data ?? []).forEach((l: any) => {
        const c = l.coa_accounts;
        const dc = Number(l.debit) - Number(l.credit);
        if (["revenue", "other_income"].includes(c.type)) { earnings -= dc; return; }
        if (["cogs", "expense"].includes(c.type)) { earnings -= dc; return; }
        const g = m.get(l.account_code) ?? { code: l.account_code, name: c.name, type: c.type, amount: 0 };
        g.amount += c.normal === "debit" ? dc : -dc;
        m.set(l.account_code, g);
      });
      const by = (t: string) => [...m.values()].filter((x) => x.type === t && Math.abs(x.amount) > 0.004).sort((a, b) => a.code.localeCompare(b.code));
      const A = sum(by("asset"), "amount"), L = sum(by("liability"), "amount"), E = sum(by("equity"), "amount");
      const rows = [
        { label: "ASET", amount: null }, ...by("asset").map((x) => ({ label: `   ${x.code} ${x.name}`, amount: x.amount })), { label: "Total aset", amount: A },
        { label: "KEWAJIBAN", amount: null }, ...by("liability").map((x) => ({ label: `   ${x.code} ${x.name}`, amount: x.amount })), { label: "Total kewajiban", amount: L },
        { label: "MODAL", amount: null }, ...by("equity").map((x) => ({ label: `   ${x.code} ${x.name}`, amount: x.amount })), { label: "   Laba berjalan (akumulasi)", amount: earnings }, { label: "Total modal", amount: E + earnings },
        { label: "Total kewajiban + modal", amount: L + E + earnings },
      ];
      return {
        stats: [{ label: "Total aset", value: A, fmt: "rp" }, { label: "Kewajiban", value: L, fmt: "rp" }, { label: "Modal", value: E + earnings, fmt: "rp" }, { label: "Selisih (harus 0)", value: A - (L + E + earnings), fmt: "rp" }],
        sections: [{ title: `Per ${f.to}`, rows, cols: [{ key: "label", label: "Akun" }, { key: "amount", label: "Saldo", fmt: "rp" }] }],
      };
    },
  },
  {
    slug: "arus-kas", title: "Arus Kas", desc: "Pergerakan uang: operasional dan pendanaan", allowed: officeProfit,
    build: async (sb, f) => {
      const [{ data: trx }, { data: trf }] = await Promise.all([
        sb.from("cash_transactions").select("ref_type, ref_id, direction, amount, trx_date").gte("trx_date", f.from).lte("trx_date", f.to).limit(100000),
        sb.from("cash_transfers").select("id, type").gte("transfer_date", f.from).lte("transfer_date", f.to),
      ]);
      const ttype = new Map((trf ?? []).map((t: any) => [t.id, t.type]));
      const LABEL: Record<string, [string, string]> = {
        invoice_payment: ["Operasional", "Penerimaan dari pabrik"], purchase_payment: ["Operasional", "Pembayaran ke petani"], advance: ["Operasional", "Panjar ke petani"],
        advance_return: ["Operasional", "Pengembalian panjar"], expense: ["Operasional", "Biaya operasional"], payroll: ["Operasional", "Gaji"], bonus: ["Operasional", "Bonus"],
        production_cost: ["Operasional", "Biaya produksi"], capital_in: ["Pendanaan", "Setoran modal pemilik"], capital_out: ["Pendanaan", "Penarikan pemilik"],
      };
      const m = new Map<string, any>();
      (trx ?? []).forEach((t: any) => {
        let key = t.ref_type;
        if (t.ref_type === "transfer") {
          const ty = ttype.get(t.ref_id);
          if (ty !== "capital_in" && ty !== "capital_out") return; // transfer antarkas internal tidak dihitung
          key = ty;
        }
        const [group, label] = LABEL[key] ?? ["Operasional", key];
        const g = m.get(key) ?? { group, label, in: 0, out: 0 };
        if (t.direction === "in") g.in += Number(t.amount); else g.out += Number(t.amount);
        m.set(key, g);
      });
      const rows = [...m.values()].map((g) => ({ ...g, net: g.in - g.out })).sort((a, b) => a.group.localeCompare(b.group));
      const op = rows.filter((r) => r.group === "Operasional"), fin = rows.filter((r) => r.group === "Pendanaan");
      return {
        stats: [{ label: "Arus kas operasional", value: sum(op, "net"), fmt: "rp" }, { label: "Arus kas pendanaan", value: sum(fin, "net"), fmt: "rp" }, { label: "Kenaikan/penurunan kas", value: sum(rows, "net"), fmt: "rp" }],
        sections: [{ rows, cols: [{ key: "group", label: "Kelompok" }, { key: "label", label: "Uraian" }, { key: "in", label: "Masuk", fmt: "rp" }, { key: "out", label: "Keluar", fmt: "rp" }, { key: "net", label: "Bersih", fmt: "rp" }],
          total: { group: "Total", in: sum(rows, "in"), out: sum(rows, "out"), net: sum(rows, "net") } }],
      };
    },
  },
  {
    slug: "laba-lot", title: "Laba per Lot", desc: "Keuntungan per lot dari biaya terkait dan harga jual", allowed: officeProfit,
    options: ["products"],
    filters: (o) => [{ name: "product", label: "Produk", type: "select", options: o.products }],
    build: async (sb, f) => {
      const { data } = await sb.from("v_lot_profit").select("*").gt("sold_kg", 0).order("lot_code", { ascending: false });
      const { data: lots } = await sb.from("lots").select("id, product_id, created_at").gte("created_at", f.from).lte("created_at", end(f.to));
      const ids = new Map((lots ?? []).map((l: any) => [l.id, l.product_id]));
      const rows = (data ?? []).filter((r: any) => ids.has(r.lot_id) && (!f.product || ids.get(r.lot_id) === f.product))
        .map((r: any) => ({ lot: r.lot_code, product: r.product_name, initial: r.initial_kg, sold: r.sold_kg, cost: r.unit_cost, cogs: r.cogs, revenue: r.revenue, profit: r.gross_profit, margin: r.revenue ? (r.gross_profit / r.revenue) * 100 : 0 }));
      return {
        stats: [{ label: "Penjualan", value: sum(rows, "revenue"), fmt: "rp" }, { label: "HPP", value: sum(rows, "cogs"), fmt: "rp" }, { label: "Laba kotor", value: sum(rows, "profit"), fmt: "rp" }],
        sections: [{ title: "Lot masuk pada periode ini yang sudah terjual", rows, cols: [{ key: "lot", label: "Lot" }, { key: "product", label: "Produk" }, { key: "initial", label: "Berat awal", fmt: "kg" }, { key: "sold", label: "Terjual", fmt: "kg" }, { key: "cost", label: "HPP/kg", fmt: "rp" }, { key: "cogs", label: "HPP", fmt: "rp" }, { key: "revenue", label: "Penjualan", fmt: "rp" }, { key: "profit", label: "Laba kotor", fmt: "rp" }, { key: "margin", label: "Margin", fmt: "pct" }],
          total: { lot: "Total", sold: sum(rows, "sold"), cogs: sum(rows, "cogs"), revenue: sum(rows, "revenue"), profit: sum(rows, "profit") } }],
      };
    },
  },
];
