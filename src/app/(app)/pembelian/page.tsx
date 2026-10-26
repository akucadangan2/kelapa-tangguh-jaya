import { HandCoins, Package, Scale, ShoppingCart } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { CONDITION, kg, monthStart, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Pembelian" };

export default async function PembelianPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await requireRole("owner", "finance", "warehouse");
  const raw = sp(await searchParams);
  const f = { from: raw.status || raw.goods ? "" : monthStart(), to: raw.status || raw.goods ? "" : today(), ...raw } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["officers", "products", "suppliers"]);

  let q = supabase.from("purchases")
    .select("*, suppliers(name), products(name), quality_grades(name), profiles:user_id(full_name)")
    .order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (f.from) q = q.gte("purchase_date", f.from);
  if (f.to) q = q.lte("purchase_date", f.to);
  if (f.user) q = q.eq("user_id", f.user);
  if (f.product) q = q.eq("product_id", f.product);
  if (f.supplier) q = q.eq("supplier_id", f.supplier);
  if (f.status) q = q.eq("status", f.status);
  if (f.goods) q = q.eq("goods_status", f.goods);
  const [{ data }, unverified, transit] = await Promise.all([
    q,
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("goods_status", "in_transit").neq("status", "cancelled"),
  ]);
  const rows = data ?? [];
  const act = rows.filter((r: any) => r.status !== "cancelled");
  const sum = (k: string) => act.reduce((a: number, r: any) => a + Number(r[k] ?? 0), 0);
  const office = session.isOffice;
  const onlyDefault = !raw.status && !raw.goods && Object.keys(raw).length === 0;

  return (
    <div>
      <PageHeader title="Pembelian" desc="Penimbangan, harga beli, panjar dan pembayaran ke petani">
        <ExportButtons filename="pembelian" rows={rows.map((r: any) => ({
          No: r.no, Tanggal: r.purchase_date, Petugas: r.profiles?.full_name, Petani: r.suppliers?.name, Barang: r.products?.name,
          Mutu: r.quality_grades?.name, Kondisi: CONDITION[r.condition] ?? r.condition, Bruto: r.gross_kg, Tara: r.tare_kg, Netto: r.net_kg,
          "Potongan kg": r.deduction_kg, "Berat disepakati": r.agreed_kg, ...(office ? { "Harga/kg": r.price_per_kg, "Potongan Rp": r.deduction_amount,
          Total: r.total_amount, Panjar: r.advance_allocated, Dibayar: r.paid_amount, "Sisa utang": r.balance_due } : {}),
          "Status barang": r.goods_status, Status: r.status,
        }))} />
      </PageHeader>

      <QuickTabs items={[
        { label: "Bulan ini", href: "/pembelian", active: onlyDefault },
        ...(office ? [{ label: "Belum diverifikasi", href: "/pembelian?status=submitted", active: raw.status === "submitted" && !raw.goods, count: unverified.count ?? 0 }] : []),
        { label: "Menuju gudang", href: "/pembelian?goods=in_transit", active: raw.goods === "in_transit" && !raw.status, count: transit.count ?? 0 },
        { label: "Masih di petani", href: "/pembelian?goods=at_supplier", active: raw.goods === "at_supplier" && !raw.status },
        { label: "Batal", href: "/pembelian?status=cancelled", active: raw.status === "cancelled" && !raw.goods },
      ]} />

      <FilterBar values={f} filters={[
        { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
        { name: "user", label: "Petugas", type: "select", options: opt.officers },
        { name: "supplier", label: "Petani", type: "select", options: opt.suppliers },
        { name: "product", label: "Barang", type: "select", options: opt.products },
        { name: "goods", label: "Status barang", type: "select", options: [{ value: "at_supplier", label: "Di petani" }, { value: "in_transit", label: "Dalam perjalanan" }, { value: "received", label: "Diterima gudang" }] },
        { name: "status", label: "Status", type: "select", options: [{ value: "submitted", label: "Belum diverifikasi" }, { value: "verified", label: "Terverifikasi" }, { value: "cancelled", label: "Batal" }] },
      ]} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Transaksi" value={act.length} hint={f.from ? `${tgl(f.from)} – ${tgl(f.to)}` : "Sesuai filter"} icon={ShoppingCart} />
        <Stat label="Berat disepakati" value={kg(sum("agreed_kg"))} hint={act.length ? `rata-rata ${kg(sum("agreed_kg") / act.length)}` : undefined} icon={Scale} tone="amber" />
        {office && <Stat label="Nilai pembelian" value={rp(sum("total_amount"))} hint={sum("agreed_kg") > 0 ? `rata-rata ${rp(sum("total_amount") / sum("agreed_kg"))}/kg` : undefined} icon={Package} tone="green" />}
        {office && <Stat label="Sisa utang ke petani" value={rp(sum("balance_due"))} icon={HandCoins} tone={sum("balance_due") > 0 ? "red" : "default"} href="/pembelian/panjar" />}
      </div>

      <Card padded={false}>
        <Table rows={rows} href={(r: any) => `/pembelian/${r.id}`} empty="Tidak ada pembelian untuk filter ini" cols={[
          { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.purchase_date)} /> },
          { key: "suppliers", label: "Petani / petugas", render: (r: any) => <Two main={r.suppliers?.name} sub={r.profiles?.full_name} /> },
          { key: "products", label: "Barang", render: (r: any) => <Two main={r.products?.name} sub={[r.quality_grades?.name, CONDITION[r.condition]].filter(Boolean).join(" · ") || undefined} /> },
          { key: "agreed_kg", label: "Berat", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{kg(r.agreed_kg)}</span> },
          ...(office ? [
            { key: "price_per_kg", label: "Harga/kg", align: "right" as const, render: (r: any) => <span className={r.over_limit ? "font-semibold text-red-600" : ""} title={r.over_limit ? "Melebihi batas harga" : undefined}>{rp(r.price_per_kg)}</span> },
            { key: "total_amount", label: "Total", align: "right" as const, render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.total_amount)}</span> },
            { key: "balance_due", label: "Sisa utang", align: "right" as const, render: (r: any) => (Number(r.balance_due) > 0 ? <span className="font-semibold text-red-600">{rp(r.balance_due)}</span> : <span className="text-emerald-600">Lunas</span>) },
          ] : []),
          { key: "status", label: "Status", render: (r: any) => <div className="flex flex-col items-start gap-1"><Badge status={r.goods_status} /><Badge status={r.status} /></div> },
        ]} />
      </Card>
    </div>
  );
}