import Link from "next/link";
import { Hourglass, Receipt, Tags, XCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { PhotoGrid } from "@/components/photo-grid";
import { Collapse, QuickTabs, Two } from "@/components/page-bits";
import { monthStart, rp, tgl, today } from "@/lib/format";
import { createExpense, setExpenseStatus } from "../actions";

export const metadata = { title: "Pengeluaran" };

export default async function Pengeluaran({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const raw = sp(await searchParams);
  const f = { from: raw.status ? "" : monthStart(), to: raw.status ? "" : today(), ...raw } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["categories", "cash", "vehicles", "officers", "allCash"]);
  let q = supabase.from("expenses").select("*, expense_categories(name), cash_accounts(name), profiles:user_id(full_name), vehicles(plate_no), assignments(id, no)")
    .order("expense_date", { ascending: false }).limit(1000);
  if (f.from) q = q.gte("expense_date", f.from);
  if (f.to) q = q.lte("expense_date", f.to);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.user) q = q.eq("user_id", f.user);
  if (f.status) q = q.eq("status", f.status);
  if (f.account) q = q.eq("cash_account_id", f.account);
  const [{ data }, { count: pendingCount }] = await Promise.all([
    q,
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ]);
  const rows = data ?? [];
  const act = rows.filter((r: any) => r.status !== "cancelled");
  const total = act.reduce((a: number, r: any) => a + Number(r.amount), 0);
  const byCat = new Map<string, number>();
  act.forEach((r: any) => byCat.set(r.expense_categories?.name ?? "Lainnya", (byCat.get(r.expense_categories?.name ?? "Lainnya") ?? 0) + Number(r.amount)));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...cats.map(([, v]) => v));
  const rejected = rows.filter((r: any) => r.status === "rejected").length;

  return (
    <div>
      <PageHeader title="Pengeluaran" desc={f.from ? `${tgl(f.from)} – ${tgl(f.to)}` : "BBM, perbaikan, uang makan, angkut, listrik, sewa, pulsa dan operasional lain"}>
        <ExportButtons filename="pengeluaran" rows={rows.map((r: any) => ({
          No: r.no, Tanggal: r.expense_date, Kategori: r.expense_categories?.name, Penerima: r.payee, Nominal: r.amount, Keterangan: r.description,
          Sumber: r.cash_accounts?.name, Petugas: r.profiles?.full_name, Kendaraan: r.vehicles?.plate_no, Liter: r.liters, Penugasan: r.assignments?.no, Status: r.status,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total pengeluaran" value={rp(total)} hint={`${act.length} transaksi`} icon={Receipt} tone="red" />
        <Stat label="Belum diperiksa" value={pendingCount ?? 0} hint="Dari aplikasi petugas" icon={Hourglass} tone={pendingCount ? "amber" : "default"} href="/kas/pengeluaran?status=submitted" />
        <Stat label="Kategori terbesar" value={cats[0] ? rp(cats[0][1]) : "-"} hint={cats[0]?.[0]} icon={Tags} tone="violet" />
        <Stat label="Ditolak" value={rejected} hint="Pada daftar ini" icon={XCircle} tone={rejected ? "red" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <QuickTabs items={[
              { label: "Periode ini", href: "/kas/pengeluaran", active: !raw.status },
              { label: "Belum diperiksa", href: "/kas/pengeluaran?status=submitted", active: raw.status === "submitted", count: pendingCount ?? 0 },
              { label: "Valid", href: "/kas/pengeluaran?status=valid", active: raw.status === "valid" },
              { label: "Ditolak", href: "/kas/pengeluaran?status=rejected", active: raw.status === "rejected" },
              { label: "Batal", href: "/kas/pengeluaran?status=cancelled", active: raw.status === "cancelled" },
            ]} />
            <FilterBar values={f} filters={[
              { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
              { name: "category", label: "Kategori", type: "select", options: opt.categories },
              { name: "account", label: "Sumber kas", type: "select", options: opt.allCash },
              { name: "user", label: "Petugas", type: "select", options: opt.officers },
              { name: "status", label: "Status", type: "select", options: [{ value: "submitted", label: "Belum diperiksa" }, { value: "valid", label: "Valid" }, { value: "rejected", label: "Ditolak" }, { value: "cancelled", label: "Batal" }] },
            ]} />
            <Card padded={false}>
              <Table rows={rows} empty="Tidak ada pengeluaran untuk filter ini" cols={[
                { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.expense_date)} /> },
                {
                  key: "expense_categories",
                  label: "Kategori / keterangan",
                  render: (r: any) => (
                    <Two
                      main={r.expense_categories?.name}
                      sub={[r.description, r.vehicles?.plate_no, r.liters ? `${r.liters} L` : null, r.payee ? `ke ${r.payee}` : null].filter(Boolean).join(" · ") || undefined}
                    />
                  ),
                },
                {
                  key: "profiles",
                  label: "Oleh / sumber",
                  render: (r: any) => (
                    <Two
                      main={r.profiles?.full_name ?? "-"}
                      sub={r.assignments ? <Link className="text-emerald-700 hover:underline" href={`/modal/${r.assignments.id}`}>{r.assignments.no}</Link> : r.cash_accounts?.name}
                    />
                  ),
                },
                { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className={`font-semibold ${r.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}`}>{rp(r.amount)}</span> },
                {
                  key: "status",
                  label: "Status",
                  render: (r: any) => (
                    <div className="flex flex-col items-start gap-2">
                      <Badge status={r.status} />
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "submitted" && (
                          <>
                            <ActionForm action={setExpenseStatus} submit="Valid" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="valid" /></ActionForm>
                            <ActionForm action={setExpenseStatus} submit="Tolak" variant="danger" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="rejected" /></ActionForm>
                          </>
                        )}
                        {r.status !== "cancelled" && !r.assignments && (
                          <ActionForm action={setExpenseStatus} submit="Batal" variant="ghost" inline confirm="Batalkan pengeluaran? Mutasi kas akan dihapus."><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="cancelled" /></ActionForm>
                        )}
                      </div>
                    </div>
                  ),
                },
              ]} />
            </Card>
          </div>
          {rows.length > 0 && (
            <Collapse title="Foto nota" desc="60 transaksi teratas pada daftar">
              <PhotoGrid refType="expense" refIds={rows.slice(0, 60).map((r: any) => r.id)} title="" allowUpload={false} />
            </Collapse>
          )}
        </div>

        <div className="space-y-5 lg:self-start">
          <Card title="Catat pengeluaran kantor" desc="Pengeluaran petugas dicatat dari aplikasi">
            <ActionForm action={createExpense}>
              <Grid cols={2}>
                <Field label="Tanggal"><Input name="expense_date" type="date" defaultValue={today()} /></Field>
                <Field label="Nominal"><Input name="amount" type="number" step="any" min="0" required /></Field>
              </Grid>
              <Field label="Kategori"><Select name="category_id" options={opt.categories} required placeholder="Pilih kategori" /></Field>
              <Field label="Sumber kas/bank"><Select name="cash_account_id" options={opt.cash} required placeholder="Pilih kas/bank" /></Field>
              <Field label="Penerima"><Input name="payee" /></Field>
              <Field label="Keterangan"><Input name="description" /></Field>
              <Collapse title="Rincian tambahan" desc="BBM, kendaraan, uang makan, perjalanan">
                <div className="space-y-4">
                  <Grid cols={2}>
                    <Field label="Kendaraan"><Select name="vehicle_id" options={opt.vehicles} placeholder="-" /></Field>
                    <Field label="Liter (BBM)"><Input name="liters" type="number" step="any" min="0" /></Field>
                    <Field label="Jumlah orang"><Input name="people_count" type="number" min="0" /></Field>
                    <Field label="Perjalanan / pekerjaan"><Input name="trip_note" /></Field>
                  </Grid>
                </div>
              </Collapse>
              <Field label="Foto nota/bukti"><Input name="files" type="file" multiple accept="image/*,application/pdf" /></Field>
            </ActionForm>
          </Card>

          {cats.length > 0 && (
            <Card title="Per kategori" desc="Tidak termasuk yang dibatalkan">
              <ul className="space-y-3.5">
                {cats.slice(0, 10).map(([k, v]) => (
                  <li key={k}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-slate-700">{k}</span>
                      <span className="font-semibold tabular-nums">{rp(v)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rose-400" style={{ width: `${(v / maxCat) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}