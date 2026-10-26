import { AlertTriangle, BookOpen, PenLine, Scale } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Alert, Badge, Card, Empty, Field, Grid, Input, PageHeader, Stat } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { Collapse, QuickTabs } from "@/components/page-bits";
import { monthStart, rp, tgl, today } from "@/lib/format";
import { createManualJournal, deleteManualJournal } from "../actions";
import { JournalLines } from "../journal-lines";

export const metadata = { title: "Jurnal" };

export default async function Jurnal({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance");
  if (!s.canProfit) return <Alert tone="red">Data akuntansi dibatasi sesuai kewenangan.</Alert>;
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  let q = supabase.from("journal_entries").select("*, journal_lines(*, coa_accounts(name))").gte("entry_date", f.from).lte("entry_date", f.to)
    .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (f.manual === "1") q = q.eq("is_manual", true);
  if (f.q) q = q.ilike("description", `%${f.q}%`);
  const [{ data }, { data: coa }] = await Promise.all([q, supabase.from("coa_accounts").select("code, name").eq("is_active", true).order("code")]);
  const entries = (data ?? []).map((e: any) => {
    const lines = [...(e.journal_lines ?? [])].sort((a: any, b: any) => Number(b.debit) - Number(a.debit));
    const d = lines.reduce((a: number, l: any) => a + Number(l.debit), 0);
    const c = lines.reduce((a: number, l: any) => a + Number(l.credit), 0);
    return { ...e, lines, d, c, balanced: Math.abs(d - c) < 0.5 };
  });
  const flat = entries.flatMap((e: any) => e.lines.map((l: any) => ({ Tanggal: e.entry_date, No: e.no, Keterangan: e.description, Akun: `${l.account_code} ${l.coa_accounts?.name}`, Debit: l.debit, Kredit: l.credit })));
  const totalDebit = entries.reduce((a: number, e: any) => a + e.d, 0);
  const manual = entries.filter((e: any) => e.is_manual).length;
  const unbalanced = entries.filter((e: any) => !e.balanced).length;
  const base = `/akuntansi/jurnal?from=${f.from}&to=${f.to}${f.q ? `&q=${encodeURIComponent(f.q)}` : ""}`;

  return (
    <div>
      <PageHeader title="Jurnal" desc="Transaksi yang disetujui membentuk jurnal otomatis; jurnal manual untuk saldo awal & koreksi">
        <ExportButtons filename="jurnal" rows={flat} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Jumlah jurnal" value={entries.length} hint={`${tgl(f.from)} – ${tgl(f.to)}`} icon={BookOpen} />
        <Stat label="Total debit" value={rp(totalDebit)} hint="Sama dengan total kredit bila seimbang" icon={Scale} tone="blue" />
        <Stat label="Jurnal manual" value={manual} icon={PenLine} tone={manual ? "violet" : "default"} href={`${base}&manual=1`} />
        <Stat label="Tidak seimbang" value={unbalanced} icon={AlertTriangle} tone={unbalanced ? "red" : "green"} />
      </div>

      <div className="mb-5">
        <Collapse title="Buat jurnal manual" desc="Untuk saldo awal, pencatatan aset dan koreksi">
          <ActionForm action={createManualJournal} submit="Simpan jurnal">
            <Grid cols={2}>
              <Field label="Tanggal"><Input name="date" type="date" defaultValue={today()} required /></Field>
              <Field label="Keterangan"><Input name="description" required /></Field>
            </Grid>
            <JournalLines accounts={(coa ?? []).map((c: any) => ({ value: c.code, label: `${c.code} ${c.name}` }))} />
          </ActionForm>
        </Collapse>
      </div>

      <QuickTabs items={[
        { label: "Semua", href: base, active: f.manual !== "1" },
        { label: "Manual saja", href: `${base}&manual=1`, active: f.manual === "1", count: f.manual === "1" ? entries.length : undefined },
      ]} />
      <FilterBar values={f} filters={[
        { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }, { name: "q", label: "Cari keterangan", type: "text" },
        { name: "manual", label: "Jenis", type: "select", options: [{ value: "1", label: "Manual saja" }] },
      ]} />

      {entries.length === 0 ? (
        <Empty icon={BookOpen} title="Tidak ada jurnal pada periode ini" />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-2.5">Akun</th>
                  <th className="w-36 px-4 py-2.5 text-right">Debit</th>
                  <th className="w-36 px-4 py-2.5 text-right">Kredit</th>
                </tr>
              </thead>
              {entries.map((e: any) => (
                <tbody key={e.id} className="border-b border-slate-200 last:border-b-0">
                  <tr className="bg-slate-50/80">
                    <td colSpan={3} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-medium text-slate-500">{tgl(e.entry_date)}</span>
                        <span className="font-semibold text-slate-900">{e.no}</span>
                        <span className="text-slate-600">{e.description}</span>
                        {e.is_manual && <Badge tone="violet" label="Manual" />}
                        {!e.balanced && <Badge tone="red" label="Tidak seimbang" />}
                        {e.is_manual && s.isOwner && (
                          <span className="ml-auto print:hidden">
                            <ActionForm action={deleteManualJournal} submit="Hapus" variant="ghost" inline confirm="Hapus jurnal manual ini?"><input type="hidden" name="id" value={e.id} /></ActionForm>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {e.lines.map((l: any) => (
                    <tr key={l.id}>
                      <td className={`px-4 py-2 ${Number(l.credit) > 0 ? "pl-10 text-slate-600" : "text-slate-800"}`}>
                        <span className="mr-2 font-mono text-xs text-slate-400">{l.account_code}</span>{l.coa_accounts?.name}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(l.debit) ? rp(l.debit) : ""}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(l.credit) ? rp(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}