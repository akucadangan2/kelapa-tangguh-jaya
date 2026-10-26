import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { QuickTabs } from "@/components/page-bits";
import { saveMaster } from "../actions";

export const metadata = { title: "Data master" };

type Col = { name: string; label: string; type?: "text" | "number" | "select"; options?: { value: string; label: string }[] };

function MasterTable({ table, title, desc, rows, cols }: { table: string; title: string; desc?: string; rows: any[]; cols: Col[] }) {
  const input = (c: Col, v?: any, placeholder?: string) =>
    c.type === "select"
      ? <Select name={c.name} defaultValue={v ?? ""} options={c.options ?? []} placeholder={placeholder ?? "-"} />
      : <Input name={c.name} type={c.type === "number" ? "number" : "text"} step="any" defaultValue={v ?? ""} placeholder={placeholder} />;

  return (
    <Card title={title} desc={desc ?? `${rows.length} data`} padded={false}>
      <div className="hidden gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:flex">
        {cols.map((c) => <div key={c.name} className="min-w-36 flex-1">{c.label}</div>)}
        <div className="w-16">Aktif</div>
        <div className="w-20" />
      </div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada data</p>}
        {rows.map((r) => (
          <div key={r.id} className={`px-4 py-2.5 ${r.is_active === false ? "bg-slate-50/70 opacity-70" : ""}`}>
            <ActionForm action={saveMaster} reset={false} inline submit="Simpan" variant="ghost" className="w-full !flex-nowrap max-sm:!flex-wrap">
              <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={r.id} />
              {cols.map((c) => <div key={c.name} className="min-w-36 flex-1">{input(c, r[c.name])}</div>)}
              <label className="inline-flex w-16 items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="is_active" defaultChecked={r.is_active} className="accent-emerald-600" /><span className="sm:hidden">Aktif</span></label>
            </ActionForm>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 bg-emerald-50/40 px-4 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">Tambah baru</div>
        <ActionForm action={saveMaster} inline submit="Tambah" className="w-full !flex-nowrap max-sm:!flex-wrap">
          <input type="hidden" name="table" value={table} />
          {cols.map((c) => <div key={c.name} className="min-w-36 flex-1">{input(c, undefined, c.label)}</div>)}
          <div className="hidden w-16 sm:block" />
        </ActionForm>
      </div>
    </Card>
  );
}

export default async function Master({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner");
  const f = sp(await searchParams);
  const tab = ["grades", "warehouses", "vehicles", "categories"].includes(f.tab) ? f.tab : "products";
  const supabase = await createClient();
  const [p, g, w, v, c, coa] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("quality_grades").select("*").order("product_id").order("name"),
    supabase.from("warehouses").select("*").order("name"),
    supabase.from("vehicles").select("*").order("plate_no"),
    supabase.from("expense_categories").select("*").order("name"),
    supabase.from("coa_accounts").select("code, name").eq("type", "expense").order("code"),
  ]);
  const prodOpt = (p.data ?? []).map((x: any) => ({ value: x.id, label: x.name }));
  const n = (x: any) => (x.data ?? []).length;

  return (
    <div>
      <PageHeader title="Data master" desc="Produk, mutu, gudang, kendaraan dan kategori pengeluaran" />

      <QuickTabs items={[
        { label: "Produk", href: "/pengaturan/master", active: tab === "products", count: n(p) },
        { label: "Mutu / grade", href: "/pengaturan/master?tab=grades", active: tab === "grades", count: n(g) },
        { label: "Gudang", href: "/pengaturan/master?tab=warehouses", active: tab === "warehouses", count: n(w) },
        { label: "Kendaraan", href: "/pengaturan/master?tab=vehicles", active: tab === "vehicles", count: n(v) },
        { label: "Kategori pengeluaran", href: "/pengaturan/master?tab=categories", active: tab === "categories", count: n(c) },
      ]} />

      {tab === "products" && (
        <MasterTable table="products" title="Produk" desc="Kode KOPRA / TEMPURUNG / ARANG dipakai sistem, jangan diubah" rows={p.data ?? []}
          cols={[{ name: "code", label: "Kode" }, { name: "name", label: "Nama" }, { name: "min_stock_kg", label: "Stok minimal (kg)", type: "number" }]} />
      )}
      {tab === "grades" && (
        <MasterTable table="quality_grades" title="Mutu / grade" rows={g.data ?? []}
          cols={[{ name: "product_id", label: "Produk", type: "select", options: prodOpt }, { name: "name", label: "Nama mutu" }]} />
      )}
      {tab === "warehouses" && (
        <MasterTable table="warehouses" title="Gudang" rows={w.data ?? []} cols={[{ name: "name", label: "Nama" }, { name: "address", label: "Alamat" }]} />
      )}
      {tab === "vehicles" && (
        <MasterTable table="vehicles" title="Kendaraan" rows={v.data ?? []} cols={[{ name: "plate_no", label: "Nomor polisi" }, { name: "name", label: "Keterangan" }]} />
      )}
      {tab === "categories" && (
        <MasterTable table="expense_categories" title="Kategori pengeluaran" rows={c.data ?? []}
          cols={[{ name: "code", label: "Kode" }, { name: "name", label: "Nama" }, { name: "coa_code", label: "Akun biaya", type: "select", options: (coa.data ?? []).map((a: any) => ({ value: a.code, label: `${a.code} ${a.name}` })) }]} />
      )}
    </div>
  );
}