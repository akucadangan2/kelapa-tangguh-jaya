import { AlertTriangle, Factory, PackageCheck, ShoppingCart } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { kg, monthStart, pct, tgl, today } from "@/lib/format";

export const metadata = { title: "Perbandingan berat" };

const LIMIT = 0.02;
const ratio = (a: number, b: number) => (a && b ? (b - a) / a : null);

const diffCell = (a: number, b: number) => {
  const r = ratio(a, b);
  if (r === null) return <span className="text-slate-300">-</span>;
  const bad = Math.abs(r) > LIMIT;
  return (
    <span className={`inline-flex flex-col items-end leading-tight ${bad ? "text-red-600" : "text-slate-600"}`}>
      <span className={bad ? "font-semibold" : ""}>{b - a > 0 ? "+" : ""}{kg(b - a)}</span>
      <span className={`mt-0.5 rounded-md px-1.5 text-[11px] font-semibold ${bad ? "bg-red-50" : "bg-slate-100"}`}>{pct(r * 100)}</span>
    </span>
  );
};

export default async function Perbandingan({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance", "warehouse");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const { data } = await supabase.from("v_weight_compare").select("*").gte("purchase_date", f.from).lte("purchase_date", f.to).order("purchase_date", { ascending: false });
  const all = data ?? [];
  const isBad = (r: any) => {
    const a = ratio(Number(r.purchase_kg), Number(r.received_kg));
    const b = ratio(Number(r.dispatched_kg), Number(r.factory_kg));
    return (a !== null && Math.abs(a) > LIMIT) || (b !== null && Math.abs(b) > LIMIT);
  };
  const bad = all.filter(isBad);
  const rows = f.only === "bad" ? bad : all;
  const sum = (k: string) => all.reduce((a: number, r: any) => a + Number(r[k] ?? 0), 0);
  const buy = sum("purchase_kg"), rec = sum("received_kg");
  const recDiff = ratio(buy, rec);
  const out = all.filter((r: any) => Number(r.factory_kg) > 0);
  const outSent = out.reduce((a: number, r: any) => a + Number(r.dispatched_kg ?? 0), 0);
  const outFac = out.reduce((a: number, r: any) => a + Number(r.factory_kg ?? 0), 0);
  const facDiff = ratio(outSent, outFac);
  const qs = (extra: string) => `/gudang/perbandingan?from=${f.from}&to=${f.to}${extra}`;

  return (
    <div>
      <PageHeader title="Perbandingan berat" desc="Berat beli → masuk gudang → keluar gudang → diterima pabrik, per lot">
        <ExportButtons filename="perbandingan-berat" rows={rows.map((r: any) => ({ Lot: r.lot_code, Produk: r.product_name, Petani: r.supplier_name, Pembelian: r.purchase_no, Tanggal: r.purchase_date, "Netto beli": r.purchase_kg, "Masuk gudang": r.received_kg, "Keluar gudang": r.dispatched_kg, "Diterima pabrik": r.factory_kg }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Netto beli" value={kg(buy)} hint={`${all.length} lot`} icon={ShoppingCart} />
        <Stat label="Masuk gudang" value={kg(rec)} hint={recDiff === null ? undefined : `Selisih ${pct(recDiff * 100)}`} icon={PackageCheck} tone={recDiff !== null && Math.abs(recDiff) > LIMIT ? "red" : "green"} />
        <Stat label="Diterima pabrik" value={kg(outFac)} hint={facDiff === null ? "Belum ada" : `Selisih dari kirim ${pct(facDiff * 100)}`} icon={Factory} tone={facDiff !== null && Math.abs(facDiff) > LIMIT ? "red" : "blue"} />
        <Stat label="Lot selisih > 2%" value={bad.length} icon={AlertTriangle} tone={bad.length ? "red" : "default"} href={qs("&only=bad")} />
      </div>

      <QuickTabs items={[
        { label: "Semua lot", href: qs(""), active: f.only !== "bad" },
        { label: "Selisih > 2%", href: qs("&only=bad"), active: f.only === "bad", count: bad.length },
      ]} />
      <FilterBar values={f} filters={[{ name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }]} />

      <Card padded={false}>
        <Table rows={rows} href={(r: any) => `/gudang/lot/${r.lot_id}`} empty="Tidak ada lot pada periode ini" cols={[
          { key: "lot_code", label: "Lot / tgl beli", render: (r: any) => <Two main={r.lot_code} sub={tgl(r.purchase_date)} /> },
          { key: "product_name", label: "Produk / petani", render: (r: any) => <Two main={r.product_name} sub={r.supplier_name} /> },
          { key: "purchase_kg", label: "Netto beli", align: "right", render: (r: any) => kg(r.purchase_kg) },
          { key: "received_kg", label: "Masuk gudang", align: "right", render: (r: any) => kg(r.received_kg) },
          { key: "d1", label: "Beli → gudang", align: "right", render: (r: any) => diffCell(Number(r.purchase_kg), Number(r.received_kg)) },
          { key: "dispatched_kg", label: "Keluar", align: "right", render: (r: any) => (Number(r.dispatched_kg) ? kg(r.dispatched_kg) : <span className="text-slate-300">-</span>) },
          { key: "factory_kg", label: "Diterima pabrik", align: "right", render: (r: any) => (Number(r.factory_kg) ? kg(r.factory_kg) : <span className="text-slate-300">-</span>) },
          { key: "d2", label: "Keluar → pabrik", align: "right", render: (r: any) => diffCell(Number(r.dispatched_kg), Number(r.factory_kg)) },
        ]} />
      </Card>
      <p className="mt-3 text-xs text-slate-500">Selisih di atas 2% ditandai merah.</p>
    </div>
  );
}