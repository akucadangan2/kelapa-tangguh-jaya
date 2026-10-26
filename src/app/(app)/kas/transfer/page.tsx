import Link from "next/link";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, HandCoins } from "lucide-react";
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
import { createTransfer } from "../actions";

export const metadata = { title: "Transfer & modal" };

const TYPE: Record<string, string> = { transfer: "Transfer antarkas", disbursement: "Pencairan modal petugas", return: "Setoran sisa kas petugas", capital_in: "Setoran modal pemilik", capital_out: "Penarikan pemilik" };
const TONE: Record<string, "blue" | "violet" | "gray" | "green" | "red"> = { transfer: "blue", disbursement: "violet", return: "gray", capital_in: "green", capital_out: "red" };

export default async function TransferPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["allCash"]);
  const { data } = await supabase.from("cash_transfers").select("*, from:from_account_id(name), to:to_account_id(name), assignments(id, no), profiles:created_by(full_name)")
    .gte("transfer_date", f.from).lte("transfer_date", f.to).order("transfer_date", { ascending: false });
  const period = data ?? [];
  const rows = f.type ? period.filter((r: any) => r.type === f.type) : period;
  const sum = (t: string) => period.filter((r: any) => r.type === t).reduce((a: number, r: any) => a + Number(r.amount), 0);
  const base = `/kas/transfer?from=${f.from}&to=${f.to}`;

  return (
    <div>
      <PageHeader title="Transfer antarkas & modal" desc={`Transfer antarkas tidak dihitung sebagai biaya · ${tgl(f.from)} – ${tgl(f.to)}`}>
        <ExportButtons filename="transfer" rows={rows.map((r: any) => ({ No: r.no, Tanggal: r.transfer_date, Jenis: TYPE[r.type], Dari: r.from?.name, Ke: r.to?.name, Nominal: r.amount, Penugasan: r.assignments?.no, Catatan: r.note }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Setoran modal pemilik" value={rp(sum("capital_in"))} icon={ArrowDownToLine} tone="green" />
        <Stat label="Penarikan pemilik" value={rp(sum("capital_out"))} icon={ArrowUpFromLine} tone="red" />
        <Stat label="Transfer antarkas" value={rp(sum("transfer"))} icon={ArrowLeftRight} tone="blue" />
        <Stat label="Pencairan ke petugas" value={rp(sum("disbursement"))} hint={sum("return") ? `Setoran balik ${rp(sum("return"))}` : undefined} icon={HandCoins} tone="violet" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <QuickTabs items={[
              { label: "Semua", href: base, active: !f.type },
              ...Object.entries(TYPE).map(([v, l]) => ({ label: l, href: `${base}&type=${v}`, active: f.type === v })),
            ]} />
            <FilterBar values={f} filters={[{ name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }, { name: "type", label: "Jenis", type: "select", options: Object.entries(TYPE).map(([value, label]) => ({ value, label })) }]} />
            <Card padded={false}>
              <Table rows={rows} empty="Tidak ada transfer pada periode ini" cols={[
                { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.transfer_date)} /> },
                { key: "type", label: "Jenis", render: (r: any) => <Badge tone={TONE[r.type] ?? "gray"} label={TYPE[r.type] ?? r.type} /> },
                {
                  key: "from",
                  label: "Dari → ke",
                  render: (r: any) => (
                    <Two
                      main={<span>{r.from?.name ?? (r.type === "capital_in" ? "Pemilik" : "-")} <span className="text-slate-400">→</span> {r.to?.name ?? (r.type === "capital_out" ? "Pemilik" : "-")}</span>}
                      sub={r.assignments ? <Link className="text-emerald-700 hover:underline" href={`/modal/${r.assignments.id}`}>{r.assignments.no}</Link> : r.profiles?.full_name}
                    />
                  ),
                },
                { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.amount)}</span> },
                { key: "note", label: "Catatan", render: (r: any) => <span className="text-slate-500">{r.note || "-"}</span> },
              ]} />
            </Card>
          </div>
          {rows.length > 0 && (
            <Collapse title="Bukti transfer" desc="Foto dan dokumen yang dilampirkan">
              <PhotoGrid refType="transfer" refIds={rows.map((r: any) => r.id)} title="" allowUpload={false} />
            </Collapse>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Catat transfer / modal" desc="Pencairan modal petugas dicatat dari menu Modal">
            <ActionForm action={createTransfer}>
              <Field label="Jenis"><Select name="type" options={[["transfer", TYPE.transfer], ["capital_in", TYPE.capital_in], ["capital_out", TYPE.capital_out]].map(([value, label]) => ({ value, label }))} /></Field>
              <Field label="Dari akun" hint="Kosongkan untuk setoran modal pemilik"><Select name="from_account_id" options={opt.allCash} placeholder="-" /></Field>
              <Field label="Ke akun" hint="Kosongkan untuk penarikan pemilik"><Select name="to_account_id" options={opt.allCash} placeholder="-" /></Field>
              <Grid cols={2}>
                <Field label="Nominal"><Input name="amount" type="number" step="any" min="0" required /></Field>
                <Field label="Tanggal"><Input name="transfer_date" type="date" defaultValue={today()} /></Field>
              </Grid>
              <Field label="Catatan"><Input name="note" /></Field>
              <Field label="Bukti"><Input name="files" type="file" multiple accept="image/*,application/pdf" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}