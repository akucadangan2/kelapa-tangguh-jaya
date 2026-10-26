import { CalendarCheck, CalendarClock, Lock } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, Field, Input, PageHeader, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Two } from "@/components/page-bits";
import { jam, today } from "@/lib/format";
import { setPeriod } from "../actions";

export const metadata = { title: "Tutup periode" };

const monthName = (p: string) => {
  const [y, m] = String(p).split("-").map(Number);
  if (!y || !m) return p;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
};

export default async function Periode() {
  const s = await requireRole("owner", "finance");
  const supabase = await createClient();
  const { data } = await supabase.from("accounting_periods").select("*, profiles:closed_by(full_name)").order("period", { ascending: false });
  const rows = data ?? [];
  const closed = rows.filter((r: any) => r.closed_at);
  const current = today().slice(0, 7);

  return (
    <div>
      <PageHeader title="Tutup periode" desc="Transaksi pada periode yang ditutup tidak bisa diubah; koreksi dicatat di periode berjalan" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Periode berjalan" value={monthName(current)} icon={CalendarClock} tone="blue" />
        <Stat label="Terakhir ditutup" value={closed[0] ? monthName(closed[0].period) : "-"} hint={closed[0] ? jam(closed[0].closed_at) : undefined} icon={CalendarCheck} tone="green" />
        <Stat label="Periode ditutup" value={closed.length} icon={Lock} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card padded={false}>
            <Table rows={rows} empty="Belum ada periode yang tercatat" cols={[
              { key: "period", label: "Periode", render: (r: any) => <Two main={monthName(r.period)} sub={r.period} /> },
              { key: "closed_at", label: "Status", render: (r: any) => (r.closed_at ? <Badge tone="gray" label="Ditutup" /> : <Badge tone="green" label="Terbuka" />) },
              { key: "closed_by", label: "Ditutup oleh", render: (r: any) => (r.closed_at ? <Two main={r.profiles?.full_name ?? "-"} sub={jam(r.closed_at)} /> : <span className="text-slate-300">-</span>) },
              ...(s.isOwner ? [{
                key: "x",
                label: "",
                align: "right" as const,
                render: (r: any) => (
                  <ActionForm action={setPeriod} submit={r.closed_at ? "Buka kembali" : "Tutup"} variant={r.closed_at ? "ghost" : "danger"} inline confirm={r.closed_at ? `Buka kembali periode ${monthName(r.period)}?` : `Tutup periode ${monthName(r.period)}?`}>
                    <input type="hidden" name="period" value={r.period} /><input type="hidden" name="close" value={r.closed_at ? "0" : "1"} />
                  </ActionForm>
                ),
              }] : []),
            ]} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {s.isOwner ? (
            <Card title="Tutup periode" desc="Biasanya dilakukan setelah laporan bulanan diperiksa">
              <div className="mb-4"><Alert>Setelah ditutup, transaksi pada periode tersebut tidak dapat diubah atau dihapus.</Alert></div>
              <ActionForm action={setPeriod} submit="Tutup periode" variant="danger" confirm="Tutup periode ini?">
                <input type="hidden" name="close" value="1" />
                <Field label="Periode (YYYY-MM)"><Input name="period" defaultValue={current} pattern="\d{4}-\d{2}" required /></Field>
              </ActionForm>
            </Card>
          ) : (
            <Alert tone="blue">Tutup periode hanya dapat dilakukan pemilik.</Alert>
          )}
        </div>
      </div>
    </div>
  );
}