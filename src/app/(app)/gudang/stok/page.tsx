import { Boxes, Flame, PackageCheck, Truck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { CONDITION, kg, rp, tgl } from "@/lib/format";

export const metadata = { title: "Stok & lot" };

export default async function StokPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await requireRole("owner", "finance", "warehouse");
  const raw = sp(await searchParams);
  const f = { show: "available", ...raw } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["products", "warehouses", "grades"]);
  let q = supabase.from("v_lot_balance").select("*").order("created_at", { ascending: true });
  if (f.product) q = q.eq("product_id", f.product);
  if (f.warehouse) q = q.eq("warehouse_id", f.warehouse);
  if (f.grade) q = q.eq("grade_id", f.grade);
  if (f.show === "available") q = q.gt("balance_kg", 0);
  const [{ data }, { data: transit }, { data: all }, { data: running }] = await Promise.all([
    q,
    supabase.from("v_purchases_in_transit").select("product_name, net_kg"),
    supabase.from("v_lot_balance").select("product_name, balance_kg, reserved_kg, free_kg, stock_value").gt("balance_kg", 0),
    supabase.from("production_batches").select("input_kg").eq("status", "running"),
  ]);
  const lots = data ?? [];
  const office = session.isOffice;

  const byProduct = new Map<string, any>();
  const blank = (p: string) => ({ product: p, balance: 0, reserved: 0, free: 0, value: 0, transit: 0 });
  (all ?? []).forEach((l: any) => {
    const x = byProduct.get(l.product_name) ?? blank(l.product_name);
    x.balance += Number(l.balance_kg); x.reserved += Number(l.reserved_kg); x.free += Number(l.free_kg); x.value += Number(l.stock_value);
    byProduct.set(l.product_name, x);
  });
  (transit ?? []).forEach((t: any) => {
    const x = byProduct.get(t.product_name) ?? blank(t.product_name);
    x.transit += Number(t.net_kg);
    byProduct.set(t.product_name, x);
  });
  const inProd = (running ?? []).reduce((a: number, r: any) => a + Number(r.input_kg), 0);
  const totalTransit = (transit ?? []).reduce((a: number, t: any) => a + Number(t.net_kg), 0);
  const totalStock = [...byProduct.values()].reduce((a, p) => a + p.balance, 0);
  const totalValue = [...byProduct.values()].reduce((a, p) => a + p.value, 0);
  const now = Date.now();

  return (
    <div>
      <PageHeader title="Stok & lot" desc="Stok dipisahkan menurut produk, mutu, gudang dan lot. Lot paling lama tampil di atas.">
        <ExportButtons filename="stok" rows={lots.map((l: any) => ({
          Lot: l.code, Produk: l.product_name, Mutu: l.grade_name, Kondisi: CONDITION[l.condition] ?? l.condition, Gudang: l.warehouse_name, Pemasok: l.supplier_name,
          "Berat awal": l.initial_kg, Saldo: l.balance_kg, Dipesan: l.reserved_kg, "Bebas dijual": l.free_kg, ...(office ? { "HPP/kg": l.unit_cost, Nilai: l.stock_value } : {}), Status: l.status, Lokasi: l.storage_location,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total stok" value={kg(totalStock)} hint={office ? `Nilai ${rp(totalValue)}` : `${(all ?? []).length} lot`} icon={Boxes} tone="green" />
        <Stat label="Dalam perjalanan" value={kg(totalTransit)} hint="Belum masuk gudang" icon={Truck} tone="blue" href="/pembelian?goods=in_transit" />
        <Stat label="Dalam produksi" value={kg(inProd)} hint="Tempurung di tungku" icon={Flame} tone="amber" href="/produksi" />
        <Stat label="Sudah dipesan" value={kg([...byProduct.values()].reduce((a, p) => a + p.reserved, 0))} hint="Dialokasikan ke pesanan" icon={PackageCheck} tone="violet" />
      </div>

      {byProduct.size > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...byProduct.values()].map((p) => {
            const resPct = p.balance > 0 ? Math.round((p.reserved / p.balance) * 100) : 0;
            return (
              <div key={p.product} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-slate-900">{p.product}</div>
                  <div className="text-lg font-bold tabular-nums text-slate-900">{kg(p.balance)}</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${resPct}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-slate-500">Bebas</div><div className="font-semibold text-emerald-700">{kg(p.free)}</div></div>
                  <div><div className="text-slate-500">Dipesan</div><div className="font-semibold text-amber-700">{kg(p.reserved)}</div></div>
                  <div><div className="text-slate-500">Perjalanan</div><div className="font-semibold text-sky-700">{kg(p.transit)}</div></div>
                </div>
                {office && <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">Nilai stok {rp(p.value)}</div>}
              </div>
            );
          })}
        </div>
      )}

      <QuickTabs items={[
        { label: "Semua produk", href: "/gudang/stok", active: !f.product },
        ...opt.products.map((p) => ({ label: p.label, href: `/gudang/stok?product=${p.value}`, active: f.product === p.value })),
      ]} />

      <FilterBar values={f} filters={[
        { name: "product", label: "Produk", type: "select", options: opt.products },
        { name: "grade", label: "Mutu", type: "select", options: opt.grades },
        { name: "warehouse", label: "Gudang", type: "select", options: opt.warehouses },
        { name: "show", label: "Tampilkan", type: "select", options: [{ value: "available", label: "Yang masih ada stok" }, { value: "all", label: "Semua lot" }] },
      ]} />

      <Card title={`Lot (${lots.length})`} padded={false}>
        <Table rows={lots} href={(l: any) => `/gudang/lot/${l.id}`} empty="Tidak ada lot untuk filter ini" cols={[
          {
            key: "code",
            label: "Lot / masuk",
            render: (l: any) => {
              const days = Math.floor((now - new Date(l.created_at).getTime()) / 86400000);
              return <Two main={l.code} sub={<span className={days > 30 ? "text-amber-700" : ""}>{tgl(l.created_at)} · {days} hari</span>} />;
            },
          },
          { key: "product_name", label: "Produk", render: (l: any) => <Two main={<span className="inline-flex items-center gap-1.5">{l.product_name}{l.is_rework && <Badge tone="amber" label="Proses ulang" />}</span>} sub={[l.grade_name, CONDITION[l.condition]].filter(Boolean).join(" · ") || undefined} /> },
          { key: "warehouse_name", label: "Gudang / asal", render: (l: any) => <Two main={l.warehouse_name} sub={[l.supplier_name, l.storage_location].filter(Boolean).join(" · ") || undefined} /> },
          { key: "balance_kg", label: "Saldo", align: "right", render: (l: any) => <span className="font-semibold text-slate-900">{kg(l.balance_kg)}</span> },
          { key: "reserved_kg", label: "Dipesan", align: "right", render: (l: any) => (Number(l.reserved_kg) ? <span className="text-amber-700">{kg(l.reserved_kg)}</span> : "-") },
          { key: "free_kg", label: "Bebas", align: "right", render: (l: any) => <span className="text-emerald-700">{kg(l.free_kg)}</span> },
          ...(office ? [{ key: "stock_value", label: "Nilai", align: "right" as const, render: (l: any) => <Two main={rp(l.stock_value)} sub={`${rp(l.unit_cost)}/kg`} /> }] : []),
          { key: "status", label: "Status", render: (l: any) => <Badge status={l.status} /> },
        ]} />
      </Card>
    </div>
  );
}