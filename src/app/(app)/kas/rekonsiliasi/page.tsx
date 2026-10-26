import { CalendarCheck, CheckCircle2, Scale } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Badge, Card, Field, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Two } from "@/components/page-bits";
import { jam, rp, tgl, today } from "@/lib/format";
import { createReconciliation } from "../actions";

export const metadata = { title: "Rekonsiliasi bank" };

export default async function Rekonsiliasi() {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const opt = await getOptions(["cash"]);
  const [{ data }, { data: accounts }] = await Promise.all([
    supabase.from("bank_reconciliations").select("*, cash_accounts(name), profiles:created_by(full_name)").order("period_end", { ascending: false }),
    supabase.from("v_cash_balance").select("id, name, type, bank_name, account_no, balance").eq("is_active", true).in("type", ["bank", "business"]).order("type").order("name"),
  ]);
  const rows = data ?? [];
  const last = new Map<string, any>();
  rows.forEach((r: any) => { if (!last.has(r.account_id)) last.set(r.account_id, r); });
  const withDiff = [...last.values()].filter((r: any) => Number(r.diff) !== 0).length;
  const matched = [...last.values()].filter((r: any) => Number(r.diff) === 0).length;

  return (
    <div>
      <PageHeader title="Rekonsiliasi bank" desc="Cocokkan saldo rekening koran dengan saldo sistem pada tanggal tertentu" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Akun cocok" value={matched} hint="Berdasarkan pencocokan terakhir" icon={CheckCircle2} tone="green" />
        <Stat label="Akun berselisih" value={withDiff} hint="Perlu ditelusuri" icon={Scale} tone={withDiff ? "red" : "default"} />
        <Stat label="Pencocokan terakhir" value={rows[0] ? tgl(rows[0].period_end) : "-"} hint={rows[0]?.cash_accounts?.name} icon={CalendarCheck} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Status per akun" padded={false}>
            <Table rows={accounts ?? []} empty="Belum ada akun kas/bank" cols={[
              { key: "name", label: "Akun", render: (a: any) => <Two main={a.name} sub={a.type === "bank" ? [a.bank_name, a.account_no].filter(Boolean).join(" · ") || "Rekening bank" : "Kas usaha"} /> },
              { key: "balance", label: "Saldo sistem saat ini", align: "right", render: (a: any) => <span className="font-semibold">{rp(a.balance)}</span> },
              {
                key: "last",
                label: "Pencocokan terakhir",
                render: (a: any) => {
                  const r = last.get(a.id);
                  if (!r) return <span className="text-slate-400">Belum pernah</span>;
                  return <Two main={tgl(r.period_end)} sub={Number(r.diff) === 0 ? <Badge tone="green" label="Cocok" /> : <Badge tone="red" label={`Selisih ${rp(r.diff)}`} />} />;
                },
              },
            ]} />
          </Card>

          <Card title="Riwayat rekonsiliasi" desc={`${rows.length} catatan`} padded={false}>
            <Table rows={rows} empty="Belum ada rekonsiliasi" cols={[
              { key: "period_end", label: "Per tanggal / akun", render: (r: any) => <Two main={tgl(r.period_end)} sub={r.cash_accounts?.name} /> },
              { key: "statement_balance", label: "Rekening koran", align: "right", render: (r: any) => rp(r.statement_balance) },
              { key: "system_balance", label: "Sistem", align: "right", render: (r: any) => rp(r.system_balance) },
              { key: "diff", label: "Selisih", align: "right", render: (r: any) => <span className={`font-semibold ${Number(r.diff) !== 0 ? "text-red-600" : "text-emerald-700"}`}>{Number(r.diff) === 0 ? "Cocok" : rp(r.diff)}</span> },
              { key: "note", label: "Catatan / oleh", render: (r: any) => <Two main={<span className="text-slate-600">{r.note || "-"}</span>} sub={`${r.profiles?.full_name ?? ""} · ${jam(r.created_at)}`} /> },
            ]} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Rekonsiliasi baru" desc="Saldo sistem dihitung otomatis sampai tanggal yang dipilih">
            <ActionForm action={createReconciliation}>
              <Field label="Akun"><Select name="account_id" options={opt.cash} required placeholder="Pilih akun" /></Field>
              <Field label="Per tanggal"><Input name="period_end" type="date" defaultValue={today()} required /></Field>
              <Field label="Saldo rekening koran"><Input name="statement_balance" type="number" step="any" required /></Field>
              <Field label="Catatan"><Input name="note" /></Field>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}