import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, PackageOpen, Scale, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, Info, PageHeader, Stat, Table } from "@/components/ui";
import { PhotoGrid } from "@/components/photo-grid";
import { ExportButtons } from "@/components/export-buttons";
import { BackLink, Steps, Two } from "@/components/page-bits";
import { CONDITION, jam, kg, rp, tgl } from "@/lib/format";

export const metadata = { title: "Riwayat lot" };

const MOVE: Record<string, string> = {
  in: "Masuk gudang", out: "Keluar (penjualan)", production_in: "Hasil produksi", production_out: "Dipakai produksi",
  transfer_in: "Pindahan masuk", transfer_out: "Pindah gudang", shrink: "Susut", damage: "Rusak", opname: "Stok opname", return_in: "Retur",
};

export default async function LotDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("owner", "finance", "warehouse");
  const { id } = await params;
  const supabase = await createClient();
  const { data: l } = await supabase.from("v_lot_balance").select("*").eq("id", id).single();
  if (!l) notFound();
  const office = session.isOffice;

  const [moves, purchase, receipt, batch, dispatches, profit] = await Promise.all([
    supabase.from("stock_movements").select("*, warehouses(name)").eq("lot_id", id).order("moved_at"),
    l.source_type === "purchase" ? supabase.from("purchases").select("*, suppliers(id, name), profiles:user_id(full_name)").eq("id", l.source_id).single() : { data: null },
    supabase.from("goods_receipts").select("*").eq("lot_id", id).maybeSingle(),
    l.source_type === "production" ? supabase.from("production_batches").select("*").eq("id", l.source_id).single() : { data: null },
    supabase.from("dispatch_lots").select("*, goods_dispatches(id, no, dispatched_at, sales_order_id, sales_orders(no, price_per_kg, factories(name)), factory_receipts(received_kg))").eq("lot_id", id),
    office ? supabase.from("v_lot_profit").select("*").eq("lot_id", id).maybeSingle() : { data: null },
  ]);
  const p: any = purchase.data;
  const b: any = batch.data;
  let running = 0;
  const mv = (moves.data ?? []).map((m: any) => ({ ...m, saldo: (running += Number(m.qty_kg)) }));
  const ds = dispatches.data ?? [];
  const factoryDone = ds.some((d: any) => (d.goods_dispatches?.factory_receipts ?? []).length > 0);
  const usedPct = Number(l.initial_kg) > 0 ? Math.round(((Number(l.initial_kg) - Number(l.balance_kg)) / Number(l.initial_kg)) * 100) : 0;

  const { data: relatedCost } = p && office ? await supabase.from("expenses").select("no, description, amount, expense_categories(name)").eq("purchase_id", p.id).neq("status", "cancelled") : { data: [] };
  const photoIds = [l.id, p?.id, receipt.data?.id, b?.id, ...ds.map((d: any) => d.goods_dispatches?.id)].filter(Boolean);

  return (
    <div>
      <BackLink href="/gudang/stok" label="Stok & lot" />
      <PageHeader title={`Lot ${l.code}`} desc={`${l.product_name}${l.grade_name ? " · " + l.grade_name : ""} · ${l.warehouse_name ?? "-"} · masuk ${tgl(l.created_at)}`}>
        <ExportButtons filename={`lot-${l.code}`} rows={mv.map((m: any) => ({ Waktu: m.moved_at, Jenis: MOVE[m.type] ?? m.type, Berat: m.qty_kg, Saldo: m.saldo, Gudang: m.warehouses?.name, Catatan: m.note }))} />
      </PageHeader>

      <div className="space-y-5">
        <Card>
          <Steps steps={[
            { label: p ? "Dibeli dari petani" : b ? "Hasil produksi" : "Saldo awal", done: true, sub: p ? tgl(p.purchase_date) : b ? tgl(b.batch_date) : undefined },
            { label: "Masuk gudang", done: true, sub: receipt.data ? kg(receipt.data.received_kg) : tgl(l.created_at) },
            { label: "Keluar gudang", done: ds.length > 0, sub: ds.length ? `${ds.length} pengiriman` : "Belum" },
            { label: "Diterima pabrik", done: factoryDone, sub: factoryDone ? "Sudah" : "Belum" },
          ]} />
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Berat awal" value={kg(l.initial_kg)} icon={Scale} />
          <Stat label="Saldo" value={kg(l.balance_kg)} hint={`${usedPct}% sudah keluar · dipesan ${kg(l.reserved_kg)}`} icon={PackageOpen} tone="green" />
          {office && <Stat label="HPP/kg" value={rp(l.unit_cost)} hint={`Nilai ${rp(l.stock_value)}`} icon={Coins} tone="amber" />}
          {office && profit.data && <Stat label="Laba kotor lot" value={rp(profit.data.gross_profit)} tone={Number(profit.data.gross_profit) < 0 ? "red" : "green"} hint={`Penjualan ${rp(profit.data.revenue)}`} icon={TrendingUp} />}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Asal barang" actions={<Badge status={l.status} />}>
            {p ? (
              <Info items={[
                ["Petani", <Link key="s" className="text-emerald-700 hover:underline" href={`/petani/${p.suppliers?.id}`}>{p.suppliers?.name}</Link>],
                ["Pembelian", <Link key="p" className="text-emerald-700 hover:underline" href={`/pembelian/${p.id}`}>{p.no}</Link>],
                ["Tanggal beli", tgl(p.purchase_date)], ["Petugas", p.profiles?.full_name],
                ["Netto beli", kg(p.net_kg)], ["Diterima gudang", kg(receipt.data?.received_kg)],
                ...(office ? [["Harga beli/kg", rp(p.price_per_kg)] as [string, any], ["Total beli", rp(p.total_amount)] as [string, any]] : []),
                ["Kondisi", CONDITION[l.condition] ?? "-"], ["Lokasi simpan", l.storage_location || "-"],
              ]} />
            ) : b ? (
              <Info items={[
                ["Batch produksi", <Link key="b" className="text-emerald-700 hover:underline" href={`/produksi/${b.id}`}>{b.no}</Link>],
                ["Tanggal", tgl(b.batch_date)], ["Tungku", b.kiln], ["Tempurung terpakai", kg(b.input_kg)],
                ["Rendemen", `${b.yield_pct ?? "-"}%`], ...(office ? [["HPP/kg", rp(b.hpp_per_kg)] as [string, any]] : []),
              ]} />
            ) : <p className="text-sm text-slate-500">Saldo awal / pindahan</p>}
            {office && (relatedCost ?? []).length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-slate-800">Biaya terkait</div>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {(relatedCost ?? []).map((r: any) => (
                    <li key={r.no} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                      <Two main={r.expense_categories?.name} sub={r.no} />
                      <span className="font-semibold tabular-nums">{rp(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
          <Card title="Tujuan penjualan" padded={false}>
            <Table rows={ds} href={(d: any) => `/penjualan/${d.goods_dispatches?.sales_order_id}`} empty="Belum dikirim ke pabrik" cols={[
              { key: "no", label: "Pengiriman", render: (d: any) => <Two main={d.goods_dispatches?.no} sub={tgl(d.goods_dispatches?.dispatched_at)} /> },
              { key: "factory", label: "Pabrik", render: (d: any) => d.goods_dispatches?.sales_orders?.factories?.name },
              { key: "qty_kg", label: "Berat", align: "right", render: (d: any) => kg(d.qty_kg) },
              ...(office ? [{ key: "price", label: "Harga/kg", align: "right" as const, render: (d: any) => rp(d.goods_dispatches?.sales_orders?.price_per_kg) }] : []),
            ]} />
          </Card>
        </div>

        <Card title="Pergerakan stok" desc={`${mv.length} catatan`} padded={false}>
          <Table rows={mv} empty="Belum ada pergerakan" cols={[
            { key: "moved_at", label: "Waktu", render: (m: any) => jam(m.moved_at) },
            { key: "type", label: "Jenis", render: (m: any) => <Badge tone={Number(m.qty_kg) >= 0 ? "green" : "red"} label={MOVE[m.type] ?? m.type} /> },
            { key: "warehouses", label: "Gudang", render: (m: any) => m.warehouses?.name },
            { key: "qty_kg", label: "Berat", align: "right", render: (m: any) => <span className={`font-semibold ${Number(m.qty_kg) < 0 ? "text-red-600" : "text-emerald-700"}`}>{Number(m.qty_kg) > 0 ? "+" : ""}{kg(m.qty_kg)}</span> },
            { key: "saldo", label: "Saldo", align: "right", render: (m: any) => kg(m.saldo) },
            { key: "note", label: "Catatan", render: (m: any) => <span className="text-slate-500">{m.note || "-"}</span> },
          ]} />
        </Card>

        <Card><PhotoGrid refType={["purchase", "goods_receipt", "production", "dispatch", "factory_receipt"]} refIds={photoIds} title="Seluruh foto lot" allowUpload={false} /></Card>
      </div>
    </div>
  );
}