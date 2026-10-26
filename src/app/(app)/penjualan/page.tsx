import { ClipboardList, Factory, PackageCheck, Truck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { kg, rp, tgl, today } from "@/lib/format";
import { createOrder } from "./actions";

export const metadata = { title: "Penjualan" };

const STATUSES: [string, string][] = [
  ["confirmed", "Pesanan"], ["shipped", "Terkirim"], ["received", "Diterima pabrik"], ["invoiced", "Ditagih"], ["closed", "Lunas"], ["cancelled", "Batal"],
];
const LABEL = Object.fromEntries(STATUSES);

function Progress({ order, shipped, received }: { order: number; shipped: number; received: number }) {
  const sPct = order > 0 ? Math.min(100, (shipped / order) * 100) : 0;
  const rPct = order > 0 ? Math.min(100, (received / order) * 100) : 0;
  return (
    <div className="w-32">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="absolute inset-y-0 left-0 rounded-full bg-sky-300" style={{ width: `${sPct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${rPct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">Kirim {Math.round(sPct)}% · terima {Math.round(rPct)}%</div>
    </div>
  );
}

export default async function Penjualan({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const f = sp(await searchParams);
  const supabase = await createClient();
  const opt = await getOptions(["factories", "products"]);
  const price = s.isOffice || s.canSellPrice;
  let q = supabase.from("sales_orders").select("*, factories(name), products(name), goods_dispatches(total_kg, factory_receipts(received_kg))").order("order_date", { ascending: false }).limit(500);
  if (f.status) q = q.eq("status", f.status);
  else q = q.not("status", "in", "(closed,cancelled)");
  if (f.factory) q = q.eq("factory_id", f.factory);
  if (f.from) q = q.gte("order_date", f.from);
  if (f.to) q = q.lte("order_date", f.to);
  const [{ data }, { data: counts }] = await Promise.all([
    q,
    supabase.from("sales_orders").select("status").not("status", "in", "(closed,cancelled)"),
  ]);
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    shipped: (r.goods_dispatches ?? []).reduce((a: number, d: any) => a + Number(d.total_kg), 0),
    received: (r.goods_dispatches ?? []).reduce((a: number, d: any) => {
      const fr = Array.isArray(d.factory_receipts) ? d.factory_receipts[0] : d.factory_receipts;
      return a + Number(fr?.received_kg ?? 0);
    }, 0),
  }));
  const count = (st: string) => (counts ?? []).filter((r: any) => r.status === st).length;
  const orderKg = rows.reduce((a: number, r: any) => a + Number(r.order_kg), 0);
  const shippedKg = rows.reduce((a: number, r: any) => a + r.shipped, 0);
  const receivedKg = rows.reduce((a: number, r: any) => a + r.received, 0);
  const remaining = rows.filter((r: any) => !["closed", "cancelled"].includes(r.status)).reduce((a: number, r: any) => a + Math.max(0, Number(r.order_kg) - r.shipped), 0);

  return (
    <div>
      <PageHeader title="Penjualan & pengiriman" desc="Pesanan pabrik, alokasi lot, barang keluar, penerimaan pabrik dan tagihan">
        <ExportButtons filename="penjualan" rows={rows.map((r: any) => ({
          No: r.no, Tanggal: r.order_date, Pabrik: r.factories?.name, Produk: r.products?.name, "Pesanan kg": r.order_kg,
          "Dikirim kg": r.shipped, "Diterima kg": r.received, ...(price ? { "Harga/kg": r.price_per_kg } : {}), Status: r.status,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total pesanan" value={kg(orderKg)} hint={`${rows.length} pesanan`} icon={ClipboardList} />
        <Stat label="Belum dikirim" value={kg(remaining)} hint="Sisa pesanan aktif" icon={Factory} tone={remaining > 0 ? "amber" : "default"} />
        <Stat label="Sudah dikirim" value={kg(shippedKg)} icon={Truck} tone="blue" />
        <Stat label="Diterima pabrik" value={kg(receivedKg)} hint={shippedKg ? `Selisih ${kg(receivedKg - shippedKg)}` : undefined} icon={PackageCheck} tone="green" />
      </div>

      <div className={s.isOffice ? "grid gap-5 lg:grid-cols-3" : ""}>
        <div className={s.isOffice ? "lg:col-span-2" : ""}>
          <QuickTabs items={[
            { label: "Semua aktif", href: "/penjualan", active: !f.status },
            ...STATUSES.map(([v, l]) => ({ label: l, href: `/penjualan?status=${v}`, active: f.status === v, count: ["confirmed", "shipped", "received", "invoiced"].includes(v) ? count(v) : undefined })),
          ]} />
          <FilterBar values={f} filters={[
            { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
            { name: "factory", label: "Pabrik", type: "select", options: opt.factories },
            { name: "status", label: "Status", type: "select", options: STATUSES.map(([value, label]) => ({ value, label })) },
          ]} />
          <Card padded={false}>
            <Table rows={rows} href={(r: any) => `/penjualan/${r.id}`} empty="Tidak ada pesanan untuk filter ini" cols={[
              { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.order_date)} /> },
              { key: "factories", label: "Pabrik / produk", render: (r: any) => <Two main={r.factories?.name} sub={r.products?.name} /> },
              { key: "order_kg", label: "Pesanan", align: "right", render: (r: any) => <Two main={<span className="font-semibold">{kg(r.order_kg)}</span>} sub={price ? `${rp(r.price_per_kg)}/kg` : undefined} /> },
              { key: "shipped", label: "Dikirim / diterima", align: "right", render: (r: any) => <Two main={kg(r.shipped)} sub={r.received ? `diterima ${kg(r.received)}` : undefined} /> },
              { key: "progress", label: "Progres", render: (r: any) => <Progress order={Number(r.order_kg)} shipped={r.shipped} received={r.received} /> },
              { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} label={LABEL[r.status]} /> },
            ]} />
          </Card>
        </div>

        {s.isOffice && (
          <div className="mt-5 lg:sticky lg:top-20 lg:mt-0 lg:self-start">
            <Card title="Buat pesanan penjualan" desc="Lot dialokasikan setelah pesanan dibuat">
              <ActionForm action={createOrder} submit="Buat pesanan">
                <Field label="Pabrik"><Select name="factory_id" options={opt.factories} required placeholder="Pilih pabrik" /></Field>
                <Grid cols={2}>
                  <Field label="Produk"><Select name="product_id" options={opt.products} required placeholder="Pilih" /></Field>
                  <Field label="Tanggal"><Input name="order_date" type="date" defaultValue={today()} /></Field>
                  <Field label="Berat pesanan (kg)"><Input name="order_kg" type="number" step="any" min="0" required /></Field>
                  <Field label="Harga jual (Rp/kg)"><Input name="price_per_kg" type="number" step="any" min="0" /></Field>
                </Grid>
                <p className="-mt-2 text-xs text-slate-500">Kosongkan harga untuk memakai harga pabrik terbaru.</p>
                <Field label="Catatan"><Textarea name="note" rows={2} /></Field>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}