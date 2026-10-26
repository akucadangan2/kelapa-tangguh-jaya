import { AlarmClock, CalendarClock, Factory, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { kg, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Tagihan & piutang pabrik" };

const days = (from: string, to: string) => Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);

export default async function Piutang({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = { status: "open", ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["factories"]);
  const t = today();
  let q = supabase.from("invoices").select("*, sales_orders!inner(id, no, factory_id, factories(name), products(name))").order("due_date");
  if (f.status === "open" || f.status === "overdue") q = q.in("status", ["unpaid", "partial"]);
  else if (f.status) q = q.eq("status", f.status);
  if (f.status === "overdue") q = q.lt("due_date", t);
  if (f.factory) q = q.eq("sales_orders.factory_id", f.factory);
  const [{ data }, { data: rec }, { data: open }] = await Promise.all([
    q,
    supabase.from("v_factory_receivables").select("*").gt("receivable", 0).order("receivable", { ascending: false }),
    supabase.from("invoices").select("total_amount, paid_amount, due_date").in("status", ["unpaid", "partial"]),
  ]);
  const rows = data ?? [];
  const recs = rec ?? [];
  const sisa = (r: any) => Number(r.total_amount) - Number(r.paid_amount);
  const total = recs.reduce((a: number, r: any) => a + Number(r.receivable), 0);
  const overdue = (open ?? []).filter((r: any) => r.due_date < t);
  const week = (open ?? []).filter((r: any) => r.due_date >= t && days(t, r.due_date) <= 7);
  const maxRec = Math.max(1, ...recs.map((r: any) => Number(r.receivable)));
  const base = (st: string) => `/penjualan/piutang?status=${st}${f.factory ? `&factory=${f.factory}` : ""}`;

  return (
    <div>
      <PageHeader title="Tagihan & piutang pabrik" desc="Tagihan ke pabrik yang belum dibayar, diurutkan dari jatuh tempo terdekat">
        <ExportButtons filename="piutang" rows={rows.map((r: any) => ({
          No: r.no, Pabrik: r.sales_orders?.factories?.name, Produk: r.sales_orders?.products?.name, Tanggal: r.invoice_date, "Jatuh tempo": r.due_date,
          "Berat kg": r.accepted_kg, Total: r.total_amount, Dibayar: r.paid_amount, Sisa: sisa(r), Status: r.status,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total piutang" value={rp(total)} hint={`${(open ?? []).length} tagihan belum lunas`} icon={Wallet} tone="amber" />
        <Stat label="Lewat jatuh tempo" value={rp(overdue.reduce((a: number, r: any) => a + sisa(r), 0))} hint={`${overdue.length} tagihan`} icon={AlarmClock} tone={overdue.length ? "red" : "default"} href={base("overdue")} />
        <Stat label="Jatuh tempo 7 hari" value={rp(week.reduce((a: number, r: any) => a + sisa(r), 0))} hint={`${week.length} tagihan`} icon={CalendarClock} tone={week.length ? "blue" : "default"} />
        <Stat label="Pabrik berpiutang" value={recs.length} icon={Factory} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickTabs items={[
            { label: "Belum lunas", href: base("open"), active: f.status === "open", count: (open ?? []).length },
            { label: "Lewat jatuh tempo", href: base("overdue"), active: f.status === "overdue", count: overdue.length },
            { label: "Lunas", href: base("paid"), active: f.status === "paid" },
          ]} />
          <FilterBar values={f} filters={[
            { name: "status", label: "Status", type: "select", options: [{ value: "open", label: "Belum lunas" }, { value: "overdue", label: "Lewat jatuh tempo" }, { value: "paid", label: "Lunas" }] },
            { name: "factory", label: "Pabrik", type: "select", options: opt.factories },
          ]} />
          <Card padded={false}>
            <Table rows={rows} href={(r: any) => `/penjualan/${r.sales_orders?.id}`} empty="Tidak ada tagihan untuk filter ini" cols={[
              { key: "no", label: "Tagihan", render: (r: any) => <Two main={r.no} sub={`${tgl(r.invoice_date)} · ${r.sales_orders?.no ?? ""}`} /> },
              { key: "factory", label: "Pabrik", render: (r: any) => <Two main={r.sales_orders?.factories?.name} sub={`${r.sales_orders?.products?.name ?? ""} · ${kg(r.accepted_kg)}`} /> },
              {
                key: "due_date",
                label: "Jatuh tempo",
                render: (r: any) => {
                  if (r.status === "paid") return tgl(r.due_date);
                  const d = days(t, r.due_date);
                  return <Two main={<span className={d < 0 ? "font-semibold text-red-600" : ""}>{tgl(r.due_date)}</span>} sub={<span className={d < 0 ? "text-red-600" : d <= 7 ? "text-amber-700" : ""}>{d < 0 ? `lewat ${-d} hari` : d === 0 ? "hari ini" : `${d} hari lagi`}</span>} />;
                },
              },
              { key: "total_amount", label: "Total", align: "right", render: (r: any) => <Two main={rp(r.total_amount)} sub={Number(r.paid_amount) ? `dibayar ${rp(r.paid_amount)}` : undefined} /> },
              { key: "sisa", label: "Sisa", align: "right", render: (r: any) => <span className={`font-semibold ${sisa(r) > 0 ? "text-slate-900" : "text-slate-400"}`}>{rp(sisa(r))}</span> },
              { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
            ]} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Piutang per pabrik" desc="Klik untuk menyaring daftar tagihan">
            {recs.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada piutang terbuka.</p>
            ) : (
              <ul className="space-y-4">
                {recs.map((r: any) => (
                  <li key={r.factory_id ?? r.factory_name}>
                    <a href={r.factory_id ? `/penjualan/piutang?status=open&factory=${r.factory_id}` : "#"} className="block rounded-xl p-1 hover:bg-slate-50">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800">{r.factory_name}</span>
                        <span className="font-semibold tabular-nums">{rp(r.receivable)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(Number(r.receivable) / maxRec) * 100}%` }} /></div>
                      <div className="mt-1 flex justify-between text-xs text-slate-500">
                        <span>Tempo terdekat {tgl(r.nearest_due)}</span>
                        {Number(r.overdue_count) > 0 && <span className="font-semibold text-red-600">{r.overdue_count} lewat tempo</span>}
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}