import Link from "next/link";
import { ChevronLeft, ChevronRight, MinusCircle, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Alert, Card, Field, Grid, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { Two } from "@/components/page-bits";
import { rp, tgl, today } from "@/lib/format";
import { createPayroll } from "../actions";

export const metadata = { title: "Gaji karyawan" };

const shiftMonth = (p: string, n: number) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const monthName = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
};

export default async function Gaji({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance");
  if (!s.canSalary) return <Alert tone="red">Data gaji dibatasi sesuai kewenangan.</Alert>;
  const raw = sp(await searchParams);
  const period = /^\d{4}-\d{2}$/.test(raw.period ?? "") ? raw.period : today().slice(0, 7);
  const supabase = await createClient();
  const opt = await getOptions(["staff", "cash"]);
  const { data } = await supabase.from("payrolls").select("*, cash_accounts(name)").eq("period", period).order("paid_at", { ascending: false });
  const rows = data ?? [];
  const gross = rows.reduce((a: number, r: any) => a + Number(r.gross_amount), 0);
  const ded = rows.reduce((a: number, r: any) => a + Number(r.deductions ?? 0), 0);
  const net = rows.reduce((a: number, r: any) => a + Number(r.net_amount), 0);
  const isCurrent = period >= today().slice(0, 7);
  const nav = "inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50";

  return (
    <div>
      <PageHeader title="Gaji karyawan" desc={`Periode ${monthName(period)}`}>
        <ExportButtons filename={`gaji-${period}`} rows={rows.map((r: any) => ({ No: r.no, Nama: r.employee_name, Periode: r.period, Gaji: r.gross_amount, Potongan: r.deductions, Dibayar: r.net_amount, Tanggal: r.paid_at, Sumber: r.cash_accounts?.name, Catatan: r.note }))} />
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/kas/gaji?period=${shiftMonth(period, -1)}`} className={nav}><ChevronLeft size={16} />{monthName(shiftMonth(period, -1))}</Link>
        <span className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white">{monthName(period)}</span>
        {!isCurrent && <Link href={`/kas/gaji?period=${shiftMonth(period, 1)}`} className={nav}>{monthName(shiftMonth(period, 1))}<ChevronRight size={16} /></Link>}
        {!isCurrent && <Link href="/kas/gaji" className="px-2 text-sm font-semibold text-emerald-700 hover:underline">Bulan ini</Link>}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total dibayar" value={rp(net)} icon={Wallet} tone="green" />
        <Stat label="Gaji kotor" value={rp(gross)} icon={Wallet} />
        <Stat label="Potongan" value={rp(ded)} icon={MinusCircle} tone={ded ? "amber" : "default"} />
        <Stat label="Jumlah karyawan" value={rows.length} icon={Users} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card padded={false}>
            <Table rows={rows} empty="Belum ada pembayaran gaji pada periode ini" cols={[
              { key: "employee_name", label: "Karyawan", render: (r: any) => <Two main={r.employee_name} sub={r.no} /> },
              { key: "gross_amount", label: "Gaji", align: "right", render: (r: any) => rp(r.gross_amount) },
              { key: "deductions", label: "Potongan", align: "right", render: (r: any) => (Number(r.deductions) ? <span className="text-amber-700">{rp(r.deductions)}</span> : "-") },
              { key: "net_amount", label: "Dibayar", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.net_amount)}</span> },
              { key: "paid_at", label: "Tanggal / sumber", render: (r: any) => <Two main={tgl(r.paid_at)} sub={r.cash_accounts?.name} /> },
              { key: "note", label: "Catatan", render: (r: any) => <span className="text-slate-500">{r.note || "-"}</span> },
            ]} footer={rows.length > 0 ? (
              <tr>
                <td>Total</td>
                <td className="text-right tabular-nums">{rp(gross)}</td>
                <td className="text-right tabular-nums">{rp(ded)}</td>
                <td className="text-right tabular-nums">{rp(net)}</td>
                <td colSpan={2} />
              </tr>
            ) : undefined} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Catat pembayaran gaji">
            <ActionForm action={createPayroll}>
              <Field label="Karyawan (pengguna sistem)"><Select name="employee_id" options={opt.staff} placeholder="- atau isi nama di bawah -" /></Field>
              <Field label="Nama karyawan" hint="Diisi bila bukan pengguna sistem"><Input name="employee_name" /></Field>
              <Grid cols={2}>
                <Field label="Periode"><Input name="period" defaultValue={period} placeholder="2026-10" required /></Field>
                <Field label="Tanggal bayar"><Input name="paid_at" type="date" defaultValue={today()} /></Field>
                <Field label="Gaji"><Input name="gross_amount" type="number" step="any" min="0" required /></Field>
                <Field label="Potongan"><Input name="deductions" type="number" step="any" min="0" /></Field>
              </Grid>
              <Field label="Sumber kas/bank"><Select name="cash_account_id" options={opt.cash} required placeholder="Pilih kas/bank" /></Field>
              <Field label="Catatan"><Input name="note" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}