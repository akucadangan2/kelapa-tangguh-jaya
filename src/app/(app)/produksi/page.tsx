import Link from "next/link";
import { Coins, Flame, Gauge, Package } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { kg, monthStart, pct, rp, tgl, today } from "@/lib/format";
import { createBatch } from "./actions";

export const metadata = { title: "Produksi arang" };

function YieldBar({ value }: { value: any }) {
  if (value === null || value === undefined) return <span className="text-slate-300">-</span>;
  const v = Math.max(0, Math.min(100, Number(value)));
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="font-semibold tabular-nums text-slate-900">{pct(value)}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${v}%` }} /></span>
    </span>
  );
}

export default async function Produksi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["warehouses"]);
  let q = supabase.from("production_batches").select("*, warehouses(name)").gte("batch_date", f.from).lte("batch_date", f.to).order("batch_date", { ascending: false });
  if (f.kiln) q = q.ilike("kiln", `%${f.kiln}%`);
  const [{ data }, { data: runningAll }] = await Promise.all([
    q,
    supabase.from("production_batches").select("id, input_kg").eq("status", "running"),
  ]);
  const period = data ?? [];
  const rows = f.status ? period.filter((r: any) => r.status === f.status) : period;
  const done = period.filter((r: any) => r.status === "done");
  const inKg = done.reduce((a: number, r: any) => a + Number(r.input_kg), 0);
  const outKg = done.reduce((a: number, r: any) => a + Number(r.output_good_kg), 0);
  const cost = done.reduce((a: number, r: any) => a + Number(r.total_cost), 0);
  const running = runningAll ?? [];
  const runningKg = running.reduce((a: number, r: any) => a + Number(r.input_kg ?? 0), 0);
  const base = `/produksi?from=${f.from}&to=${f.to}${f.kiln ? `&kiln=${encodeURIComponent(f.kiln)}` : ""}`;

  return (
    <div>
      <PageHeader title="Produksi arang tempurung" desc="Pencatatan per batch: bahan, biaya, hasil, rendemen dan HPP">
        <ExportButtons filename="produksi" rows={rows.map((r: any) => ({
          No: r.no, Tanggal: r.batch_date, Tungku: r.kiln, Operator: r.operator_name, Gudang: r.warehouses?.name, Basis: r.weight_basis,
          "Tempurung (kg)": r.input_kg, "Arang layak (kg)": r.output_good_kg, "Proses ulang (kg)": r.output_rework_kg, "Susut (kg)": r.loss_kg,
          "Rendemen %": r.yield_pct, ...(s.isOffice ? { "Biaya bahan": r.input_cost, "Biaya lain": r.other_cost, "Total biaya": r.total_cost, "HPP/kg": r.hpp_per_kg } : {}), Status: r.status,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Batch berjalan" value={running.length} hint={`Tempurung di tungku ${kg(runningKg)}`} icon={Flame} tone={running.length ? "blue" : "default"} href={`${base}&status=running`} />
        <Stat label="Arang layak jual" value={kg(outKg)} hint={`Dari ${kg(inKg)} tempurung · ${done.length} batch`} icon={Package} tone="green" />
        <Stat label="Rendemen rata-rata" value={inKg ? pct((outKg / inKg) * 100) : "-"} hint="Batch selesai pada periode ini" icon={Gauge} tone="violet" />
        {s.isOffice && <Stat label="HPP rata-rata/kg" value={outKg ? rp(cost / outKg) : "-"} hint={`Total biaya ${rp(cost)}`} icon={Coins} tone="amber" />}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickTabs items={[
            { label: "Semua", href: base, active: !f.status },
            { label: "Berjalan", href: `${base}&status=running`, active: f.status === "running", count: period.filter((r: any) => r.status === "running").length },
            { label: "Selesai", href: `${base}&status=done`, active: f.status === "done" },
          ]} />
          <FilterBar values={f} filters={[
            { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
            { name: "kiln", label: "Tungku", type: "text" },
            { name: "status", label: "Status", type: "select", options: [{ value: "running", label: "Berjalan" }, { value: "done", label: "Selesai" }] },
          ]} />
          <Card padded={false}>
            <Table rows={rows} href={(r: any) => `/produksi/${r.id}`} empty="Belum ada batch pada periode ini" cols={[
              { key: "no", label: "Batch / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.batch_date)} /> },
              { key: "kiln", label: "Tungku / operator", render: (r: any) => <Two main={r.kiln ?? "-"} sub={[r.operator_name, r.warehouses?.name].filter(Boolean).join(" · ") || undefined} /> },
              { key: "input_kg", label: "Tempurung", align: "right", render: (r: any) => kg(r.input_kg) },
              { key: "output_good_kg", label: "Arang layak", align: "right", render: (r: any) => (r.status === "done" ? <span className="font-semibold text-emerald-700">{kg(r.output_good_kg)}</span> : <span className="text-slate-300">-</span>) },
              { key: "yield_pct", label: "Rendemen", align: "right", render: (r: any) => (r.status === "done" ? <YieldBar value={r.yield_pct} /> : <span className="text-slate-300">-</span>) },
              ...(s.isOffice ? [{ key: "hpp_per_kg", label: "HPP/kg", align: "right" as const, render: (r: any) => (r.status === "done" ? rp(r.hpp_per_kg) : <span className="text-slate-300">-</span>) }] : []),
              { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
            ]} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Mulai batch baru" desc="Bahan baku dan biaya diisi di halaman batch">
            <ActionForm action={createBatch} submit="Buat batch">
              <Grid cols={2}>
                <Field label="Tanggal"><Input type="date" name="batch_date" defaultValue={today()} /></Field>
                <Field label="Basis timbang"><Select name="weight_basis" options={[{ value: "dry", label: "Kering" }, { value: "wet", label: "Basah" }]} /></Field>
              </Grid>
              <Field label="Tungku / lokasi"><Input name="kiln" required placeholder="Contoh: Tungku 1" /></Field>
              <Field label="Gudang"><Select name="warehouse_id" options={opt.warehouses} required placeholder="Pilih gudang" /></Field>
              <Field label="Operator"><Input name="operator_name" /></Field>
              <Field label="Catatan"><Textarea name="note" rows={2} /></Field>
            </ActionForm>
          </Card>
          {running.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Ada {running.length} batch berjalan. <Link href={`${base}&status=running`} className="font-semibold text-emerald-700 hover:underline">Lihat</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}