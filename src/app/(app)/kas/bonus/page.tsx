import { Gift, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Card, Field, Grid, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { Two } from "@/components/page-bits";
import { monthStart, rp, tgl, today } from "@/lib/format";
import { createBonus } from "../actions";

export const metadata = { title: "Bonus" };

export default async function Bonus({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["staff", "cash"]);
  const { data } = await supabase.from("bonuses").select("*, cash_accounts(name)").gte("paid_at", f.from).lte("paid_at", f.to).order("paid_at", { ascending: false });
  const rows = data ?? [];
  const total = rows.reduce((a: number, r: any) => a + Number(r.amount), 0);
  const people = new Set(rows.map((r: any) => r.recipient_name)).size;

  return (
    <div>
      <PageHeader title="Bonus" desc={`${tgl(f.from)} – ${tgl(f.to)}`}>
        <ExportButtons filename="bonus" rows={rows.map((r: any) => ({ No: r.no, Penerima: r.recipient_name, Alasan: r.reason, Periode: r.period, Nominal: r.amount, Tanggal: r.paid_at, Sumber: r.cash_accounts?.name }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Total bonus" value={rp(total)} hint={`${rows.length} pembayaran`} icon={Gift} tone="violet" />
        <Stat label="Jumlah penerima" value={people} icon={Users} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FilterBar values={f} filters={[{ name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }]} />
          <Card padded={false}>
            <Table rows={rows} empty="Belum ada bonus pada periode ini" cols={[
              { key: "recipient_name", label: "Penerima", render: (r: any) => <Two main={r.recipient_name} sub={r.no} /> },
              { key: "reason", label: "Alasan / periode", render: (r: any) => <Two main={<span className="text-slate-700">{r.reason}</span>} sub={r.period} /> },
              { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.amount)}</span> },
              { key: "paid_at", label: "Tanggal / sumber", render: (r: any) => <Two main={tgl(r.paid_at)} sub={r.cash_accounts?.name} /> },
            ]} footer={rows.length > 0 ? (
              <tr>
                <td colSpan={2}>Total</td>
                <td className="text-right tabular-nums">{rp(total)}</td>
                <td />
              </tr>
            ) : undefined} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Catat bonus">
            <ActionForm action={createBonus}>
              <Field label="Penerima (pengguna sistem)"><Select name="recipient_id" options={opt.staff} placeholder="- atau isi nama di bawah -" /></Field>
              <Field label="Nama penerima" hint="Diisi bila bukan pengguna sistem"><Input name="recipient_name" /></Field>
              <Field label="Alasan"><Input name="reason" required /></Field>
              <Grid cols={2}>
                <Field label="Periode"><Input name="period" defaultValue={today().slice(0, 7)} /></Field>
                <Field label="Tanggal"><Input name="paid_at" type="date" defaultValue={today()} /></Field>
              </Grid>
              <Field label="Nominal"><Input name="amount" type="number" step="any" min="0" required /></Field>
              <Field label="Sumber kas/bank"><Select name="cash_account_id" options={opt.cash} required placeholder="Pilih kas/bank" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}