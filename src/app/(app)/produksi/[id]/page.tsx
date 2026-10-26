import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, Flame, Gauge, Package } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Info, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { BackLink, Collapse, Steps, Two } from "@/components/page-bits";
import { jam, kg, pct, rp, tgl, today } from "@/lib/format";
import { addCost, addInput, finishBatch, removeInput } from "../actions";

export const metadata = { title: "Batch produksi" };

const COST: Record<string, string> = { labor: "Tenaga kerja", fuel: "Bahan bakar", other: "Lainnya" };

export default async function BatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase.from("production_batches").select("*, warehouses(name), out:output_lot_id(id, code), rework:rework_lot_id(id, code)").eq("id", id).single();
  if (!b) notFound();
  const [inputs, costs, lots, opt] = await Promise.all([
    supabase.from("production_inputs").select("*, lots(id, code, products(name))").eq("batch_id", id),
    supabase.from("production_costs").select("*, cash_accounts(name)").eq("batch_id", id),
    supabase.from("v_lot_balance").select("id, code, product_code, product_name, balance_kg, warehouse_name").eq("product_code", "TEMPURUNG").gt("free_kg", 0),
    getOptions(["cash", "grades"]),
  ]);
  const running = b.status === "running";
  const done = b.status === "done";
  const office = s.isOffice;
  const inRows = inputs.data ?? [];
  const costRows = costs.data ?? [];
  const inSum = inRows.reduce((a: number, r: any) => a + Number(r.qty_kg), 0);
  const inCost = inRows.reduce((a: number, r: any) => a + Number(r.qty_kg) * Number(r.unit_cost ?? 0), 0);
  const otherCost = costRows.reduce((a: number, r: any) => a + Number(r.amount), 0);
  const arangGrades = opt.raw.grades.filter((g: any) => g.products?.name?.toLowerCase().includes("arang")).map((g: any) => ({ value: g.id, label: g.name }));
  const basis = b.weight_basis === "wet" ? "basah" : "kering";

  return (
    <div>
      <BackLink href="/produksi" label="Produksi" />
      <PageHeader title={`Batch ${b.no}`} desc={`${tgl(b.batch_date)} · ${b.kiln ?? "-"} · ${b.warehouses?.name ?? "-"}`}>
        <Badge status={b.status} />
      </PageHeader>

      <div className="space-y-5">
        <Card>
          <Steps steps={[
            { label: "Batch dibuat", done: true, sub: tgl(b.batch_date) },
            { label: "Bahan baku", done: inRows.length > 0, sub: inRows.length ? kg(inSum) : "Belum diisi", warn: running && inRows.length === 0 },
            { label: "Biaya produksi", done: costRows.length > 0, sub: costRows.length ? (office ? rp(otherCost) : `${costRows.length} catatan`) : "Belum ada" },
            { label: "Selesai", done, sub: done ? jam(b.finished_at) : "Masih berjalan" },
          ]} />
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Tempurung terpakai" value={kg(done ? b.input_kg : inSum)} hint={`Basis ${basis}`} icon={Flame} tone="blue" />
          <Stat label="Arang layak jual" value={done ? kg(b.output_good_kg) : "-"} hint={done ? `Proses ulang ${kg(b.output_rework_kg)} · susut ${kg(b.loss_kg)}` : "Diisi saat selesai"} icon={Package} tone="green" />
          <Stat label="Rendemen" value={done ? pct(b.yield_pct) : "-"} hint="Arang layak ÷ tempurung" icon={Gauge} tone="violet" />
          {office && <Stat label={done ? "HPP arang/kg" : "Biaya sementara"} value={done ? rp(b.hpp_per_kg) : rp(inCost + otherCost)} hint={done ? `Total ${rp(b.total_cost)}` : `Bahan ${rp(inCost)} + lain ${rp(otherCost)}`} icon={Coins} tone="amber" />}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Bahan baku tempurung" desc={`${inRows.length} lot · ${kg(inSum)}`} padded={false}>
              <Table rows={inRows} empty="Belum ada bahan baku" cols={[
                { key: "lots", label: "Lot", render: (r: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/gudang/lot/${r.lots?.id}`}>{r.lots?.code}</Link>} sub={r.lots?.products?.name} /> },
                { key: "qty_kg", label: "Berat", align: "right", render: (r: any) => <span className="font-semibold">{kg(r.qty_kg)}</span> },
                ...(office ? [{ key: "unit_cost", label: "Biaya", align: "right" as const, render: (r: any) => <Two main={rp(Number(r.qty_kg) * Number(r.unit_cost))} sub={`${rp(r.unit_cost)}/kg`} /> }] : []),
                ...(running ? [{ key: "x", label: "", align: "right" as const, render: (r: any) => <ActionForm action={removeInput} submit="Hapus" variant="ghost" inline confirm="Hapus bahan ini dari batch?"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="batch_id" value={b.id} /></ActionForm> }] : []),
              ]} />
              {running && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <ActionForm action={addInput} submit="Tambah bahan">
                    <input type="hidden" name="batch_id" value={b.id} />
                    <Grid cols={2}>
                      <Field label="Lot tempurung"><Select name="lot_id" required placeholder="Pilih lot" options={(lots.data ?? []).map((l: any) => ({ value: l.id, label: `${l.code} · ${l.warehouse_name} (${kg(l.balance_kg)})` }))} /></Field>
                      <Field label="Berat dipakai (kg)"><Input name="qty_kg" type="number" step="any" min="0" required /></Field>
                    </Grid>
                  </ActionForm>
                </div>
              )}
            </Card>

            <Card title="Biaya produksi" desc={office ? `Total ${rp(otherCost)}` : `${costRows.length} catatan`} padded={false}>
              <Table rows={costRows} empty="Belum ada biaya" cols={[
                { key: "type", label: "Jenis / tanggal", render: (r: any) => <Two main={COST[r.type] ?? r.type} sub={tgl(r.cost_date)} /> },
                { key: "note", label: "Keterangan", render: (r: any) => <span className="text-slate-600">{r.note || "-"}</span> },
                { key: "cash_accounts", label: "Sumber", render: (r: any) => (r.cash_accounts?.name ?? <Badge tone="amber" label="Utang" />) },
                { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.amount)}</span> },
              ]} />
              {running && office && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <ActionForm action={addCost} submit="Tambah biaya">
                    <input type="hidden" name="batch_id" value={b.id} />
                    <Grid cols={2}>
                      <Field label="Jenis"><Select name="type" options={Object.entries(COST).map(([value, label]) => ({ value, label }))} /></Field>
                      <Field label="Nominal"><Input name="amount" type="number" step="any" min="0" required /></Field>
                      <Field label="Dibayar dari"><Select name="cash_account_id" options={opt.cash} placeholder="Belum dibayar (utang)" /></Field>
                      <Field label="Tanggal"><Input name="cost_date" type="date" defaultValue={today()} /></Field>
                    </Grid>
                    <Field label="Keterangan"><Input name="note" /></Field>
                  </ActionForm>
                </div>
              )}
            </Card>

            {running && (
              <Card title="Selesaikan batch" desc="Isi hasil timbang arang setelah pembakaran selesai">
                <div className="mb-4">
                  <Alert>Setelah selesai, pemakaian tempurung dan biaya dikunci, lalu stok arang bertambah. Basis timbang harus sama ({basis}).</Alert>
                </div>
                {inRows.length === 0 ? (
                  <Alert tone="red">Tambahkan bahan baku tempurung terlebih dahulu.</Alert>
                ) : (
                  <ActionForm action={finishBatch} submit="Selesaikan batch" confirm="Selesaikan batch dan tambahkan stok arang?">
                    <input type="hidden" name="batch_id" value={b.id} />
                    <Grid cols={2}>
                      <Field label="Arang layak jual (kg)"><Input name="output_good_kg" type="number" step="any" min="0" required /></Field>
                      <Field label="Mutu arang"><Select name="grade_id" options={arangGrades} placeholder="-" /></Field>
                      <Field label="Perlu proses ulang (kg)"><Input name="output_rework_kg" type="number" step="any" min="0" placeholder="0" /></Field>
                      <Field label="Susut / kehilangan (kg)" hint="Kosongkan untuk dihitung otomatis"><Input name="loss_kg" type="number" step="any" min="0" /></Field>
                    </Grid>
                  </ActionForm>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Card title="Data batch">
              <Info items={[
                ["Operator", b.operator_name || "-"], ["Gudang", b.warehouses?.name], ["Basis timbang", basis === "basah" ? "Basah" : "Kering"],
                ["Lot hasil", b.out ? <Link key="o" className="text-emerald-700 hover:underline" href={`/gudang/lot/${b.out.id}`}>{b.out.code}</Link> : "-"],
                ["Lot proses ulang", b.rework ? <Link key="r" className="text-emerald-700 hover:underline" href={`/gudang/lot/${b.rework.id}`}>{b.rework.code}</Link> : "-"],
                ["Selesai", done ? jam(b.finished_at) : "-"], ["Catatan", b.note || "-"],
              ]} />
            </Card>
            <Collapse title="Foto produksi" desc="Sebelum proses, timbangan dan hasil akhir" open>
              <PhotoGrid refType="production" refIds={[b.id]} title="" kinds={["before", "after", "scale", "other"]} />
            </Collapse>
          </div>
        </div>
      </div>
    </div>
  );
}