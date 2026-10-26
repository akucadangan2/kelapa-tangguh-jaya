import Link from "next/link";
import { HandCoins, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { rp, tgl, today } from "@/lib/format";
import { giveAdvance, returnAdvance } from "../actions";

export const metadata = { title: "Panjar & utang petani" };

export default async function PanjarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const raw = sp(await searchParams);
  const view = raw.view === "list" || raw.supplier || raw.user || raw.status ? "list" : "balance";
  const f = { status: "open", ...raw } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["suppliers", "cash", "officers"]);
  let q = supabase.from("advances").select("*, suppliers(id, name), profiles:user_id(full_name), cash_accounts(name)").order("given_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.supplier) q = q.eq("supplier_id", f.supplier);
  if (f.user) q = q.eq("user_id", f.user);
  const [{ data }, { data: bal }, { data: openAll }] = await Promise.all([
    q,
    supabase.from("v_supplier_balances").select("*").or("open_advance.gt.0,payable.gt.0").order("supplier_name"),
    supabase.from("advances").select("id, no, remaining, suppliers(name)").eq("status", "open").order("given_at"),
  ]);
  const rows = data ?? [];
  const balances = bal ?? [];
  const totalAdv = balances.reduce((a: number, b: any) => a + Number(b.open_advance), 0);
  const totalPay = balances.reduce((a: number, b: any) => a + Number(b.payable), 0);

  return (
    <div>
      <PageHeader title="Panjar & utang petani" desc="Panjar tercatat per petani sampai dipotong pada pembelian atau dikembalikan">
        <ExportButtons filename="panjar-utang-petani" sheets={[
          { name: "Panjar", rows: rows.map((r: any) => ({ No: r.no, Tanggal: r.given_at, Petani: r.suppliers?.name, Petugas: r.profiles?.full_name, Nominal: r.amount, Dipotong: r.allocated_amount, Dikembalikan: r.returned_amount, Sisa: r.remaining, Status: r.status })) },
          { name: "Saldo per petani", rows: balances.map((b: any) => ({ Petani: b.supplier_name, HP: b.phone, "Panjar terbuka": b.open_advance, "Utang ke petani": b.payable })) },
        ]} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Panjar belum kembali" value={rp(totalAdv)} hint="Uang petani yang dipegang usaha" icon={HandCoins} tone="amber" />
        <Stat label="Utang ke petani" value={rp(totalPay)} hint="Pembelian yang belum lunas" icon={Wallet} tone={totalPay > 0 ? "red" : "default"} />
        <Stat label="Petani terkait" value={balances.length} hint="Punya panjar atau utang" icon={Users} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickTabs items={[
            { label: "Saldo per petani", href: "/pembelian/panjar", active: view === "balance" },
            { label: "Daftar panjar", href: "/pembelian/panjar?view=list", active: view === "list" },
          ]} />

          {view === "balance" ? (
            <Card padded={false}>
              <Table rows={balances} href={(b: any) => `/petani/${b.supplier_id}`} empty="Tidak ada panjar atau utang yang terbuka" cols={[
                { key: "supplier_name", label: "Petani", render: (b: any) => <Two main={b.supplier_name} sub={b.phone} /> },
                { key: "open_advance", label: "Panjar belum kembali", align: "right", render: (b: any) => (Number(b.open_advance) > 0 ? <span className="font-semibold text-amber-700">{rp(b.open_advance)}</span> : "-") },
                { key: "payable", label: "Utang ke petani", align: "right", render: (b: any) => (Number(b.payable) > 0 ? <span className="font-semibold text-red-600">{rp(b.payable)}</span> : "-") },
              ]} />
            </Card>
          ) : (
            <>
              <FilterBar values={f} filters={[
                { name: "status", label: "Status", type: "select", options: [{ value: "open", label: "Terbuka" }, { value: "settled", label: "Selesai" }] },
                { name: "supplier", label: "Petani", type: "select", options: opt.suppliers },
                { name: "user", label: "Petugas", type: "select", options: opt.officers },
              ]} />
              <Card padded={false}>
                <Table rows={rows} empty="Tidak ada panjar" cols={[
                  { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.given_at)} /> },
                  { key: "suppliers", label: "Petani", render: (r: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/petani/${r.suppliers?.id}`}>{r.suppliers?.name}</Link>} sub={r.profiles?.full_name ?? r.cash_accounts?.name} /> },
                  { key: "amount", label: "Diberikan", align: "right", render: (r: any) => rp(r.amount) },
                  { key: "allocated_amount", label: "Dipotong", align: "right", render: (r: any) => (Number(r.allocated_amount) ? rp(r.allocated_amount) : "-") },
                  { key: "returned_amount", label: "Kembali", align: "right", render: (r: any) => (Number(r.returned_amount) ? rp(r.returned_amount) : "-") },
                  { key: "remaining", label: "Sisa", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.remaining)}</span> },
                  { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
                ]} />
              </Card>
            </>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card title="Beri panjar dari kantor" desc="Panjar dari petugas lapangan dicatat lewat aplikasi">
            <ActionForm action={giveAdvance}>
              <Field label="Petani"><Select name="supplier_id" options={opt.suppliers} required placeholder="Pilih petani" /></Field>
              <Field label="Dari kas/bank"><Select name="cash_account_id" options={opt.cash} required /></Field>
              <Grid cols={2}>
                <Field label="Nominal"><Input name="amount" type="number" step="any" required /></Field>
                <Field label="Tanggal"><Input name="given_at" type="date" defaultValue={today()} /></Field>
              </Grid>
              <Field label="Keterangan"><Input name="note" /></Field>
            </ActionForm>
          </Card>
          <Card title="Catat pengembalian panjar" desc="Petani mengembalikan uang panjar">
            <ActionForm action={returnAdvance}>
              <Field label="Panjar">
                <Select name="advance_id" required placeholder="Pilih panjar" options={(openAll ?? []).map((r: any) => ({ value: r.id, label: `${r.suppliers?.name} · ${r.no} (sisa ${rp(r.remaining)})` }))} />
              </Field>
              <Field label="Masuk ke kas/bank"><Select name="cash_account_id" options={opt.cash} required /></Field>
              <Grid cols={2}>
                <Field label="Nominal"><Input name="amount" type="number" step="any" required /></Field>
                <Field label="Tanggal"><Input name="returned_at" type="date" defaultValue={today()} /></Field>
              </Grid>
              <Field label="Keterangan"><Input name="note" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}