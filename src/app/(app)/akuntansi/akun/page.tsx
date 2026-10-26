import Link from "next/link";
import { Coins, Landmark, Scale, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Alert, Card, PageHeader, Stat, Table } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { rp } from "@/lib/format";

export const metadata = { title: "Bagan akun & saldo" };

const TYPES: [string, string][] = [
  ["asset", "Aset"], ["liability", "Kewajiban"], ["equity", "Modal"], ["revenue", "Pendapatan"], ["cogs", "HPP"], ["expense", "Biaya"], ["other_income", "Pendapatan lain"],
];
const TYPE = Object.fromEntries(TYPES);

export default async function Akun({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance");
  if (!s.canProfit) return <Alert tone="red">Data akuntansi dibatasi sesuai kewenangan.</Alert>;
  const f = sp(await searchParams);
  const supabase = await createClient();
  const { data } = await supabase.from("v_account_balances").select("*").order("code");
  const all = data ?? [];
  const sum = (t: string) => all.filter((r: any) => r.type === t).reduce((a: number, r: any) => a + Number(r.balance), 0);
  const hideZero = f.nonzero === "1";
  const rows = all.filter((r: any) => (!f.type || r.type === f.type) && (!hideZero || Number(r.balance) !== 0 || Number(r.debit) !== 0 || Number(r.credit) !== 0));
  const groups = TYPES.filter(([t]) => rows.some((r: any) => r.type === t));
  const qs = (type?: string, nz = hideZero) => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (nz) p.set("nonzero", "1");
    const x = p.toString();
    return `/akuntansi/akun${x ? `?${x}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Bagan akun & saldo" desc="Saldo setiap akun dari seluruh jurnal">
        <ExportButtons filename="saldo-akun" rows={all.map((r: any) => ({ Kode: r.code, Akun: r.name, Jenis: TYPE[r.type], Debit: r.debit, Kredit: r.credit, Saldo: r.balance }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Aset" value={rp(sum("asset"))} icon={Landmark} tone="blue" href={qs("asset")} />
        <Stat label="Kewajiban" value={rp(sum("liability"))} icon={Scale} tone="amber" href={qs("liability")} />
        <Stat label="Modal" value={rp(sum("equity"))} icon={Coins} tone="violet" href={qs("equity")} />
        <Stat label="Pendapatan" value={rp(sum("revenue") + sum("other_income"))} icon={TrendingUp} tone="green" href={qs("revenue")} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <QuickTabs items={[
          { label: "Semua", href: qs(), active: !f.type },
          ...TYPES.map(([v, l]) => ({ label: l, href: qs(v), active: f.type === v })),
        ]} />
        <Link href={qs(f.type, !hideZero)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600">
          <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition ${hideZero ? "bg-emerald-600" : "bg-slate-300"}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow transition ${hideZero ? "translate-x-4" : ""}`} />
          </span>
          Sembunyikan saldo nol
        </Link>
      </div>

      <div className="space-y-5">
        {groups.length === 0 && <Card><p className="text-sm text-slate-500">Tidak ada akun untuk filter ini.</p></Card>}
        {groups.map(([t, label]) => {
          const list = rows.filter((r: any) => r.type === t);
          const d = list.reduce((a: number, r: any) => a + Number(r.debit), 0);
          const c = list.reduce((a: number, r: any) => a + Number(r.credit), 0);
          const b = list.reduce((a: number, r: any) => a + Number(r.balance), 0);
          return (
            <Card key={t} title={label} desc={`${list.length} akun`} actions={<span className="text-sm font-bold tabular-nums text-slate-900">{rp(b)}</span>} padded={false}>
              <Table rows={list} cols={[
                { key: "code", label: "Akun", render: (r: any) => <Two main={<span><span className="mr-2 font-mono text-xs text-slate-400">{r.code}</span>{r.name}</span>} /> },
                { key: "debit", label: "Total debit", align: "right", render: (r: any) => (Number(r.debit) ? rp(r.debit) : <span className="text-slate-300">-</span>) },
                { key: "credit", label: "Total kredit", align: "right", render: (r: any) => (Number(r.credit) ? rp(r.credit) : <span className="text-slate-300">-</span>) },
                { key: "balance", label: "Saldo", align: "right", render: (r: any) => <span className={`font-semibold ${Number(r.balance) < 0 ? "text-red-600" : Number(r.balance) === 0 ? "text-slate-400" : "text-slate-900"}`}>{rp(r.balance)}</span> },
              ]} footer={
                <tr>
                  <td>Subtotal {label.toLowerCase()}</td>
                  <td className="text-right tabular-nums">{rp(d)}</td>
                  <td className="text-right tabular-nums">{rp(c)}</td>
                  <td className="text-right tabular-nums">{rp(b)}</td>
                </tr>
              } />
            </Card>
          );
        })}
      </div>
    </div>
  );
}