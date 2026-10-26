import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Scale, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { BackLink, QuickTabs, Two } from "@/components/page-bits";
import { monthStart, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Mutasi kas" };

const TYPE: Record<string, string> = { business: "Kas usaha", bank: "Rekening bank", field: "Kas petugas" };
const REF: Record<string, string> = {
  purchase_payment: "Bayar pembelian", advance: "Panjar", advance_return: "Pengembalian panjar", expense: "Pengeluaran",
  transfer: "Transfer", invoice_payment: "Pembayaran pabrik", payroll: "Gaji", bonus: "Bonus", production_cost: "Biaya produksi",
};

const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export default async function KasDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const { id } = await params;
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const { data: acc } = await supabase.from("v_cash_balance").select("*").eq("id", id).single();
  if (!acc) notFound();
  const [{ data: before }, { data }] = await Promise.all([
    supabase.from("cash_transactions").select("direction, amount").eq("account_id", id).lt("trx_date", f.from),
    supabase.from("cash_transactions").select("*").eq("account_id", id).gte("trx_date", f.from).lte("trx_date", f.to).order("trx_date").order("created_at"),
  ]);
  const opening = (before ?? []).reduce((a: number, t: any) => a + (t.direction === "in" ? 1 : -1) * Number(t.amount), 0);
  let bal = opening;
  const rows = (data ?? []).map((t: any) => ({ ...t, saldo: (bal += (t.direction === "in" ? 1 : -1) * Number(t.amount)) }));
  const tin = rows.filter((r: any) => r.direction === "in").reduce((a: number, r: any) => a + Number(r.amount), 0);
  const tout = rows.filter((r: any) => r.direction === "out").reduce((a: number, r: any) => a + Number(r.amount), 0);
  const closing = opening + tin - tout;

  const t = today();
  const ms = monthStart();
  const pm = new Date(ms + "T00:00:00Z");
  pm.setUTCMonth(pm.getUTCMonth() - 1);
  const prevStart = pm.toISOString().slice(0, 10);
  const prevEnd = addDays(ms, -1);
  const yearStart = `${t.slice(0, 4)}-01-01`;
  const link = (a: string, b: string) => `/kas/${id}?from=${a}&to=${b}`;
  const sub = acc.type === "bank" ? [acc.bank_name, acc.account_no].filter(Boolean).join(" ") : acc.owner_name;
  const table = [{ id: "opening", opening: true, trx_date: f.from, saldo: opening }, ...rows];

  return (
    <div>
      <BackLink href="/kas" label="Kas & bank" />
      <PageHeader title={acc.name} desc={`${TYPE[acc.type] ?? ""}${sub ? ` · ${sub}` : ""} · ${tgl(f.from)} – ${tgl(f.to)}`}>
        <ExportButtons filename={`mutasi-${acc.name}`} rows={[
          { Tanggal: f.from, Keterangan: "Saldo awal", Masuk: "", Keluar: "", Saldo: opening },
          ...rows.map((r: any) => ({ Tanggal: r.trx_date, Jenis: REF[r.ref_type] ?? r.ref_type, Keterangan: r.description, Masuk: r.direction === "in" ? r.amount : "", Keluar: r.direction === "out" ? r.amount : "", Saldo: r.saldo })),
        ]} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Saldo awal" value={rp(opening)} hint={tgl(f.from)} icon={Wallet} />
        <Stat label="Penerimaan" value={rp(tin)} hint={`${rows.filter((r: any) => r.direction === "in").length} transaksi`} icon={ArrowDownLeft} tone="green" />
        <Stat label="Pengeluaran" value={rp(tout)} hint={`${rows.filter((r: any) => r.direction === "out").length} transaksi`} icon={ArrowUpRight} tone="red" />
        <Stat label="Saldo akhir" value={rp(closing)} hint={tgl(f.to)} icon={Scale} tone={closing < 0 ? "red" : "blue"} />
      </div>

      <QuickTabs items={[
        { label: "Bulan ini", href: link(ms, t), active: f.from === ms && f.to === t },
        { label: "Bulan lalu", href: link(prevStart, prevEnd), active: f.from === prevStart && f.to === prevEnd },
        { label: "Tahun ini", href: link(yearStart, t), active: f.from === yearStart && f.to === t },
      ]} />
      <FilterBar values={f} filters={[{ name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }]} />

      <Card title="Mutasi" desc={`${rows.length} transaksi`} padded={false}>
        <Table rows={table} cols={[
          { key: "trx_date", label: "Tanggal", render: (r: any) => <span className="whitespace-nowrap">{tgl(r.trx_date)}</span> },
          { key: "ref_type", label: "Jenis / keterangan", render: (r: any) => (r.opening ? <span className="font-semibold text-slate-500">Saldo awal</span> : <Two main={<Badge tone={r.direction === "in" ? "green" : "red"} label={REF[r.ref_type] ?? r.ref_type} />} sub={r.description} />) },
          { key: "in", label: "Masuk", align: "right", render: (r: any) => (!r.opening && r.direction === "in" ? <span className="font-semibold text-emerald-700">{rp(r.amount)}</span> : "") },
          { key: "out", label: "Keluar", align: "right", render: (r: any) => (!r.opening && r.direction === "out" ? <span className="font-semibold text-red-600">{rp(r.amount)}</span> : "") },
          { key: "saldo", label: "Saldo", align: "right", render: (r: any) => <span className={`${r.opening ? "font-semibold" : ""} ${Number(r.saldo) < 0 ? "text-red-600" : "text-slate-900"}`}>{rp(r.saldo)}</span> },
        ]} footer={
          <tr>
            <td colSpan={2}>Total periode</td>
            <td className="text-right tabular-nums text-emerald-700">{rp(tin)}</td>
            <td className="text-right tabular-nums text-red-600">{rp(tout)}</td>
            <td className="text-right tabular-nums">{rp(closing)}</td>
          </tr>
        } />
      </Card>
    </div>
  );
}