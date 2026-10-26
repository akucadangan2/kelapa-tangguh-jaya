import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { QuickTabs } from "@/components/page-bits";
import { jam } from "@/lib/format";

export const metadata = { title: "Jejak perubahan" };

const SKIP = new Set(["created_at", "updated_at", "received_at"]);
const TABLES: Record<string, string> = {
  purchases: "Pembelian", purchase_payments: "Pembayaran pembelian", advances: "Panjar", expenses: "Pengeluaran", assignments: "Modal petugas",
  accountabilities: "LPJ", cash_transfers: "Transfer kas", invoices: "Tagihan", invoice_payments: "Pembayaran tagihan", payrolls: "Gaji", bonuses: "Bonus",
  factory_prices: "Harga pabrik", stock_adjustments: "Penyesuaian stok", stock_opnames: "Stok opname", goods_receipts: "Barang masuk", goods_dispatches: "Barang keluar",
  production_batches: "Produksi", journal_entries: "Jurnal", suppliers: "Petani", cash_accounts: "Akun kas",
};
const ACTION: Record<string, { label: string; tone: "green" | "amber" | "red" }> = {
  INSERT: { label: "Buat", tone: "green" }, UPDATE: { label: "Ubah", tone: "amber" }, DELETE: { label: "Hapus", tone: "red" },
};

function diff(o: any, n: any) {
  if (!o || !n) return [];
  return Object.keys(n).filter((k) => !SKIP.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => ({ k, from: o[k], to: n[k] }));
}
const show = (v: any) => (v === null || v === undefined || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner");
  const f = sp(await searchParams);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  if (f.table) q = q.eq("table_name", f.table);
  if (f.action) q = q.eq("action", f.action);
  if (f.record) q = q.eq("record_id", f.record);
  const [{ data }, { data: users }] = await Promise.all([q, supabase.from("profiles").select("id, full_name")]);
  const name = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));
  const rows = data ?? [];
  const base = (action?: string) => {
    const p = new URLSearchParams();
    if (f.table) p.set("table", f.table);
    if (action) p.set("action", action);
    const x = p.toString();
    return `/pengaturan/audit${x ? `?${x}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Jejak perubahan" desc="Semua pembuatan, koreksi dan penghapusan transaksi penting (300 catatan terakhir)" />

      <QuickTabs items={[
        { label: "Semua", href: base(), active: !f.action },
        ...Object.entries(ACTION).map(([k, a]) => ({ label: a.label, href: base(k), active: f.action === k })),
      ]} />
      <FilterBar values={f} filters={[
        { name: "table", label: "Data", type: "select", options: Object.entries(TABLES).map(([value, label]) => ({ value, label })) },
        { name: "action", label: "Aksi", type: "select", options: Object.entries(ACTION).map(([value, a]) => ({ value, label: a.label })) },
      ]} />

      {rows.length === 0 ? (
        <Empty title="Tidak ada catatan untuk filter ini" />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100">
            {rows.map((a: any) => {
              const d = diff(a.old_data, a.new_data);
              const label = a.new_data?.no ?? a.old_data?.no ?? a.new_data?.name ?? a.old_data?.name ?? a.record_id;
              const act = ACTION[a.action] ?? { label: a.action, tone: "gray" as any };
              return (
                <li key={a.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={act.tone} label={act.label} />
                      <span className="font-medium text-slate-800">{TABLES[a.table_name] ?? a.table_name}</span>
                      <span className="text-slate-500">· {label}</span>
                    </div>
                    <span className="text-xs text-slate-500">{name.get(a.user_id) ?? "Sistem"} · {jam(a.created_at)}</span>
                  </div>
                  {d.length > 0 && (
                    <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-100">
                          {d.slice(0, 12).map((x) => (
                            <tr key={x.k}>
                              <td className="w-40 whitespace-nowrap bg-slate-50/80 px-3 py-1.5 font-mono text-slate-500">{x.k}</td>
                              <td className="px-3 py-1.5 text-red-600 line-through decoration-red-300">{show(x.from)}</td>
                              <td className="w-6 text-center text-slate-300">→</td>
                              <td className="px-3 py-1.5 font-medium text-emerald-700">{show(x.to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {d.length > 12 && <div className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400">+{d.length - 12} kolom lain berubah</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}