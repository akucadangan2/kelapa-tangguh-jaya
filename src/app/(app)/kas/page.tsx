import Link from "next/link";
import { ArrowLeftRight, Banknote, Landmark, Receipt, Scale, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, Empty, Field, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { Two } from "@/components/page-bits";
import { rp } from "@/lib/format";
import { saveCashAccount } from "./actions";

export const metadata = { title: "Kas & bank" };

const TYPE: Record<string, string> = { business: "Kas usaha", bank: "Rekening bank", field: "Kas petugas" };
const GROUPS: [string, string, string][] = [
  ["business", "Kas usaha", "Uang tunai di kantor"],
  ["bank", "Rekening bank", "Saldo rekening usaha"],
  ["field", "Kas petugas", "Uang modal yang dipegang petugas lapangan"],
];

export default async function KasPage() {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const { data } = await supabase.from("v_cash_balance").select("*").eq("is_active", true).order("type").order("name");
  const rows = data ?? [];
  const tot = (t: string) => rows.filter((r: any) => r.type === t).reduce((a: number, r: any) => a + Number(r.balance), 0);
  const total = tot("business") + tot("bank") + tot("field");
  const negative = rows.filter((r: any) => Number(r.balance) < 0).length;

  return (
    <div>
      <PageHeader title="Kas & bank" desc="Kas usaha, rekening bank dan kas setiap petugas memiliki saldo dan mutasi sendiri">
        <ExportButtons filename="saldo-kas" rows={rows.map((r: any) => ({ Akun: r.name, Jenis: TYPE[r.type], Pemegang: r.owner_name, Masuk: r.total_in, Keluar: r.total_out, Saldo: r.balance }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total semua kas" value={rp(total)} hint={`${rows.length} akun aktif`} icon={Wallet} tone={total < 0 ? "red" : "green"} />
        <Stat label="Kas usaha" value={rp(tot("business"))} icon={Banknote} />
        <Stat label="Bank" value={rp(tot("bank"))} icon={Landmark} tone="blue" />
        <Stat label="Kas di petugas" value={rp(tot("field"))} hint="Modal yang belum dipertanggungjawabkan" icon={Users} tone="amber" />
      </div>

      {negative > 0 && <div className="mb-5"><Alert tone="red">{negative} akun bersaldo minus. Periksa mutasi akun tersebut.</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {rows.length === 0 && <Empty icon={Wallet} title="Belum ada akun kas" desc="Tambahkan kas usaha atau rekening bank melalui form di samping." />}
          {GROUPS.map(([type, title, desc]) => {
            const list = rows.filter((r: any) => r.type === type);
            if (list.length === 0) return null;
            return (
              <Card key={type} title={title} desc={desc} actions={<span className="text-sm font-bold tabular-nums text-slate-900">{rp(tot(type))}</span>} padded={false}>
                <Table rows={list} href={(r: any) => `/kas/${r.id}`} cols={[
                  { key: "name", label: "Akun", render: (r: any) => <Two main={r.name} sub={r.type === "bank" ? [r.bank_name, r.account_no].filter(Boolean).join(" · ") || undefined : r.owner_name} /> },
                  { key: "total_in", label: "Masuk", align: "right", render: (r: any) => <span className="text-emerald-700">{rp(r.total_in)}</span> },
                  { key: "total_out", label: "Keluar", align: "right", render: (r: any) => <span className="text-slate-600">{rp(r.total_out)}</span> },
                  { key: "balance", label: "Saldo", align: "right", render: (r: any) => <span className={`font-semibold ${Number(r.balance) < 0 ? "text-red-600" : "text-slate-900"}`}>{rp(r.balance)}</span> },
                ]} />
              </Card>
            );
          })}
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card title="Tambah akun kas/bank">
            <ActionForm action={saveCashAccount}>
              <Field label="Nama akun"><Input name="name" required placeholder="Contoh: Kas kantor" /></Field>
              <Field label="Jenis"><Select name="type" options={[{ value: "business", label: "Kas usaha" }, { value: "bank", label: "Rekening bank" }]} /></Field>
              <Field label="Nama bank"><Input name="bank_name" placeholder="Khusus rekening bank" /></Field>
              <Field label="No. rekening"><Input name="account_no" /></Field>
            </ActionForm>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Kas petugas dibuat otomatis saat pengguna diberi peran Petugas Lapangan. Saldo awal dicatat lewat Transfer &amp; modal → Setoran modal pemilik.</p>
          </Card>
          <Card title="Pintasan">
            <div className="grid gap-2">
              {[
                ["/kas/transfer", "Transfer & modal", ArrowLeftRight],
                ["/kas/pengeluaran", "Pengeluaran", Receipt],
                ["/kas/rekonsiliasi", "Rekonsiliasi bank", Scale],
              ].map(([href, label, Icon]: any) => (
                <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/50">
                  <Icon size={17} className="text-slate-400" />{label}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}