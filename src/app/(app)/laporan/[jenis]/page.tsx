import { notFound, redirect } from "next/navigation";
import { BarChart3, Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Card, PageHeader, Stat } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { BackLink, QuickTabs } from "@/components/page-bits";
import { kg, num, pct, rp, tgl, today } from "@/lib/format";
import { REPORTS, type Fmt } from "../reports";

export async function generateMetadata({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await params;
  const rep = REPORTS.find((r) => r.slug === jenis);
  return { title: rep ? `Laporan ${rep.title}` : "Laporan" };
}

const fmt = (v: any, f?: Fmt) => {
  if (v === null || v === undefined || v === "") return "";
  switch (f) {
    case "rp": return rp(v);
    case "kg": return kg(v);
    case "pct": return pct(v);
    case "date": return tgl(v);
    case "num": return num(v);
    default: return String(v);
  }
};
const isNum = (f?: Fmt) => !!f && f !== "text" && f !== "date";

function ranges() {
  const t = today();
  const d = new Date(t + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - dow * 864e5).toISOString().slice(0, 10);
  return [
    ["Hari ini", t, t],
    ["Minggu ini", monday, t],
    ["Bulan ini", t.slice(0, 8) + "01", t],
    ["Tahun ini", t.slice(0, 5) + "01-01", t],
  ];
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ jenis: string }>; searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const { jenis } = await params;
  const rep = REPORTS.find((r) => r.slug === jenis);
  if (!rep || !rep.allowed(s)) notFound();
  if (rep.href) redirect(rep.href);
  const t = today();
  const f = { from: t.slice(0, 8) + "01", to: t, ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = rep.options ? await getOptions(rep.options as any) : ({} as any);
  const built = await rep.build!(supabase, f, s);
  const extra = rep.filters ? rep.filters(opt) : [];
  const qs = (from: string, to: string) => new URLSearchParams({ ...f, from, to }).toString();

  return (
    <div>
      <div className="print:hidden"><BackLink href="/laporan" label="Laporan" /></div>
      <div className="mb-4 hidden border-b border-slate-300 pb-3 print:block">
        <div className="text-base font-bold text-slate-900">Kelapa Tangguh Jaya</div>
        <div className="text-xs text-slate-500">Dicetak {new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</div>
      </div>

      <PageHeader title={`Laporan ${rep.title}`} desc={`${tgl(f.from)} – ${tgl(f.to)}${rep.desc ? ` · ${rep.desc}` : ""}`}>
        <ExportButtons filename={`laporan-${rep.slug}-${f.from}-${f.to}`} sheets={built.sections.map((sec, i) => ({
          name: sec.title ?? `Data ${i + 1}`,
          rows: [...sec.rows, ...(sec.total ? [sec.total] : [])].map((r) => Object.fromEntries(sec.cols.map((c) => [c.label, r[c.key] ?? ""]))),
        }))} />
      </PageHeader>

      <div className="print:hidden">
        <QuickTabs items={(() => {
          const rs = ranges();
          const hit = rs.findIndex(([, a, b]) => f.from === a && f.to === b);
          return rs.map(([label, a, b], i) => ({ label, href: `?${qs(a, b)}`, active: i === hit }));
        })()} />
        <FilterBar values={f} filters={[{ name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" }, ...extra]} />
      </div>

      {built.stats && built.stats.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {built.stats.map((x, i) => (
            <Stat
              key={x.label}
              label={x.label}
              value={fmt(x.value, x.fmt) || "0"}
              icon={i === 0 ? BarChart3 : undefined}
              tone={x.fmt === "rp" && Number(x.value) < 0 ? "red" : i === 0 ? "green" : "default"}
            />
          ))}
        </div>
      )}

      <div className="space-y-5">
        {built.sections.map((sec, i) => (
          <div key={i} className="break-inside-avoid">
            <Card title={sec.title} desc={sec.rows.length ? `${sec.rows.length} baris` : undefined} padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                      {sec.cols.map((c) => (
                        <th key={c.key} className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-500 ${isNum(c.fmt) ? "text-right" : ""}`}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sec.rows.length === 0 && (
                      <tr>
                        <td colSpan={sec.cols.length} className="px-4 py-10 text-center">
                          <Inbox size={28} className="mx-auto mb-2 text-slate-300" />
                          <span className="text-sm text-slate-400">Tidak ada data pada periode ini</span>
                        </td>
                      </tr>
                    )}
                    {sec.rows.map((r, j) => {
                      const heading = typeof r.label === "string" && r.label.trim() !== "" && r.label === r.label.toUpperCase();
                      return (
                        <tr key={j} className={heading ? "bg-slate-50 font-semibold text-slate-900" : "transition hover:bg-emerald-50/40"}>
                          {sec.cols.map((c) => {
                            const v = r[c.key];
                            const neg = c.fmt === "rp" && v !== "" && v !== null && v !== undefined && Number(v) < 0;
                            return (
                              <td key={c.key} className={`whitespace-pre px-4 py-2.5 align-top ${isNum(c.fmt) ? "text-right tabular-nums" : ""} ${neg ? "text-red-600" : heading ? "" : "text-slate-700"}`}>
                                {fmt(v, c.fmt)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  {sec.total && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-slate-900">
                        {sec.cols.map((c) => {
                          const v = sec.total![c.key];
                          const neg = c.fmt === "rp" && v !== "" && v !== null && v !== undefined && Number(v) < 0;
                          return (
                            <td key={c.key} className={`px-4 py-3 ${isNum(c.fmt) ? "text-right tabular-nums" : ""} ${neg ? "text-red-600" : ""}`}>
                              {fmt(v, c.key === sec.cols[0].key ? "text" : c.fmt)}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}