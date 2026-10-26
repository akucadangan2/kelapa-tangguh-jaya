import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { Two } from "@/components/page-bits";
import { jam, kg, monthStart, tgl, today } from "@/lib/format";

export const metadata = { title: "Mutasi stok" };

const MOVE: Record<string, string> = {
  in: "Masuk gudang", out: "Keluar (penjualan)", production_in: "Hasil produksi", production_out: "Dipakai produksi",
  transfer_in: "Pindahan masuk", transfer_out: "Pindah gudang", shrink: "Susut", damage: "Rusak", opname: "Stok opname", return_in: "Retur",
};

export default async function Mutasi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance", "warehouse");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["warehouses", "products"]);
  let q = supabase.from("stock_movements").select("*, lots!inner(id, code, product_id, products(name)), warehouses(name)")
    .gte("moved_at", f.from).lte("moved_at", f.to + "T23:59:59+07:00").order("moved_at", { ascending: false }).limit(2000);
  if (f.warehouse) q = q.eq("warehouse_id", f.warehouse);
  if (f.type) q = q.eq("type", f.type);
  if (f.product) q = q.eq("lots.product_id", f.product);
  const { data } = await q;
  const rows = data ?? [];
  const totIn = rows.filter((r: any) => r.qty_kg > 0).reduce((a: number, r: any) => a + Number(r.qty_kg), 0);
  const totOut = rows.filter((r: any) => r.qty_kg < 0).reduce((a: number, r: any) => a + Number(r.qty_kg), 0);

  return (
    <div>
      <PageHeader title="Mutasi stok" desc={`${tgl(f.from)} – ${tgl(f.to)}`}>
        <ExportButtons filename="mutasi-stok" rows={rows.map((r: any) => ({ Waktu: jam(r.moved_at), Lot: r.lots?.code, Produk: r.lots?.products?.name, Gudang: r.warehouses?.name, Jenis: MOVE[r.type] ?? r.type, Berat: r.qty_kg, Catatan: r.note }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Masuk" value={kg(totIn)} hint={`${rows.filter((r: any) => r.qty_kg > 0).length} catatan`} icon={ArrowDownRight} tone="green" />
        <Stat label="Keluar" value={kg(-totOut)} hint={`${rows.filter((r: any) => r.qty_kg < 0).length} catatan`} icon={ArrowUpRight} tone="red" />
        <Stat label="Perubahan bersih" value={`${totIn + totOut >= 0 ? "+" : ""}${kg(totIn + totOut)}`} icon={Scale} tone={totIn + totOut >= 0 ? "green" : "amber"} />
      </div>

      <FilterBar values={f} filters={[
        { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
        { name: "product", label: "Produk", type: "select", options: opt.products },
        { name: "warehouse", label: "Gudang", type: "select", options: opt.warehouses },
        { name: "type", label: "Jenis", type: "select", options: Object.entries(MOVE).map(([value, label]) => ({ value, label })) },
      ]} />

      <Card padded={false}>
        <Table rows={rows} empty="Tidak ada mutasi pada periode ini" cols={[
          { key: "moved_at", label: "Waktu", render: (r: any) => <span className="whitespace-nowrap">{jam(r.moved_at)}</span> },
          { key: "lots", label: "Lot / produk", render: (r: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/gudang/lot/${r.lots?.id}`}>{r.lots?.code}</Link>} sub={r.lots?.products?.name} /> },
          { key: "warehouses", label: "Gudang", render: (r: any) => r.warehouses?.name },
          { key: "type", label: "Jenis", render: (r: any) => <Badge tone={Number(r.qty_kg) >= 0 ? "green" : "red"} label={MOVE[r.type] ?? r.type} /> },
          { key: "qty_kg", label: "Berat", align: "right", render: (r: any) => <span className={`font-semibold ${r.qty_kg < 0 ? "text-red-600" : "text-emerald-700"}`}>{r.qty_kg > 0 ? "+" : ""}{kg(r.qty_kg)}</span> },
          { key: "note", label: "Catatan", render: (r: any) => <span className="text-slate-500">{r.note || "-"}</span> },
        ]} />
      </Card>
    </div>
  );
}