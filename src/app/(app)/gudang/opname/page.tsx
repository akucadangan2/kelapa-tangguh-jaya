import Link from "next/link";
import { ClipboardCheck, ClipboardList, Hourglass, Scale } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Alert, Badge, Card, Empty, Field, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { QuickTabs, Two } from "@/components/page-bits";
import { jam, kg, rp, tgl, today } from "@/lib/format";
import { createOpname, setOpnameStatus } from "../actions";

export const metadata = { title: "Stok opname" };

export default async function Opname({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const f = sp(await searchParams);
  const tab = f.tab === "history" || f.tab === "new" ? f.tab : "pending";
  const supabase = await createClient();
  const opt = await getOptions(["warehouses"]);
  const { data } = await supabase.from("stock_opnames")
    .select("*, warehouses(name), profiles:user_id(full_name), approver:approved_by(full_name), stock_opname_items(*, lots(id, code, unit_cost, products(name)))")
    .order("created_at", { ascending: false }).limit(50);
  const all = data ?? [];
  const pending = all.filter((o: any) => o.status === "submitted");
  const shown = tab === "pending" ? pending : all.filter((o: any) => o.status !== "submitted");
  const lots = tab === "new" && f.warehouse
    ? (await supabase.from("v_lot_balance").select("id, code, product_name, grade_name, balance_kg").eq("warehouse_id", f.warehouse).gt("balance_kg", 0).order("product_name")).data ?? []
    : [];
  const pendingDiff = pending.reduce((a: number, o: any) => a + (o.stock_opname_items ?? []).reduce((b: number, i: any) => b + Number(i.diff_kg), 0), 0);
  const lastApproved = all.find((o: any) => o.status === "approved");

  return (
    <div>
      <PageHeader title="Stok opname" desc="Hasil hitung fisik per lot. Saldo stok baru berubah setelah disetujui kantor." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Menunggu persetujuan" value={pending.length} icon={Hourglass} tone={pending.length ? "amber" : "default"} href="/gudang/opname" />
        <Stat label="Selisih belum disetujui" value={`${pendingDiff > 0 ? "+" : ""}${kg(pendingDiff)}`} icon={Scale} tone={pendingDiff < 0 ? "red" : "default"} />
        <Stat label="Opname terakhir disetujui" value={lastApproved ? tgl(lastApproved.opname_date) : "-"} hint={lastApproved?.warehouses?.name} icon={ClipboardCheck} tone="green" />
      </div>

      <QuickTabs items={[
        { label: "Menunggu persetujuan", href: "/gudang/opname", active: tab === "pending", count: pending.length },
        { label: "Riwayat", href: "/gudang/opname?tab=history", active: tab === "history" },
        { label: "Buat opname baru", href: "/gudang/opname?tab=new", active: tab === "new" },
      ]} />

      {tab !== "new" && (
        <div className="space-y-5">
          {shown.length === 0 && (
            <Empty icon={ClipboardList} title={tab === "pending" ? "Tidak ada opname yang menunggu" : "Belum ada riwayat opname"} desc="Opname dapat dikirim dari aplikasi gudang atau dari website.">
              <Link href="/gudang/opname?tab=new" className="text-sm font-semibold text-emerald-700 hover:underline">Buat opname baru</Link>
            </Empty>
          )}
          {shown.map((o: any) => {
            const items = o.stock_opname_items ?? [];
            const diff = items.reduce((a: number, i: any) => a + Number(i.diff_kg), 0);
            const value = items.reduce((a: number, i: any) => a + Number(i.diff_kg) * Number(i.lots?.unit_cost ?? 0), 0);
            const changed = items.filter((i: any) => Number(i.diff_kg) !== 0).length;
            return (
              <Card key={o.id} title={`${o.no} · ${o.warehouses?.name ?? "-"}`} desc={`${tgl(o.opname_date)} · oleh ${o.profiles?.full_name ?? "-"}${o.approver ? ` · diperiksa ${o.approver.full_name} ${jam(o.approved_at)}` : ""}`} actions={<Badge status={o.status} />} padded={false}>
                <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
                  {[
                    ["Lot dihitung", String(items.length)],
                    ["Lot berselisih", String(changed)],
                    ["Total selisih", `${diff > 0 ? "+" : ""}${kg(diff)}`],
                    ...(s.isOffice ? [["Nilai selisih", rp(value)]] : []),
                  ].map(([l, v]) => (
                    <div key={l} className="bg-white px-5 py-3">
                      <div className="text-xs text-slate-500">{l}</div>
                      <div className="font-semibold tabular-nums text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
                {o.note && <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">{o.note}</p>}
                <Table rows={items} cols={[
                  { key: "lot", label: "Lot / produk", render: (i: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/gudang/lot/${i.lots?.id}`}>{i.lots?.code}</Link>} sub={i.lots?.products?.name} /> },
                  { key: "system_kg", label: "Sistem", align: "right", render: (i: any) => kg(i.system_kg) },
                  { key: "counted_kg", label: "Hitung fisik", align: "right", render: (i: any) => <span className="font-semibold">{kg(i.counted_kg)}</span> },
                  { key: "diff_kg", label: "Selisih", align: "right", render: (i: any) => <span className={`font-semibold ${i.diff_kg < 0 ? "text-red-600" : i.diff_kg > 0 ? "text-emerald-700" : "text-slate-400"}`}>{i.diff_kg > 0 ? "+" : ""}{kg(i.diff_kg)}</span> },
                  { key: "reason", label: "Alasan", render: (i: any) => <span className="text-slate-500">{i.reason || "-"}</span> },
                ]} />
                <div className="space-y-4 border-t border-slate-100 p-5">
                  <PhotoGrid refType="opname" refIds={[o.id]} allowUpload={false} />
                  {o.status === "submitted" && s.isOffice && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionForm action={setOpnameStatus} submit="Setujui & sesuaikan stok" inline confirm="Setujui dan sesuaikan saldo stok sesuai hitung fisik?"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="approved" /></ActionForm>
                      <ActionForm action={setOpnameStatus} submit="Tolak" variant="danger" inline confirm="Tolak opname ini?"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="rejected" /></ActionForm>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "new" && (
        <div className="space-y-5">
          <Card title="1. Pilih gudang" desc="Daftar lot dengan saldo akan muncul setelah gudang dipilih">
            <form method="get" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tab" value="new" />
              <div className="min-w-56 flex-1 sm:max-w-sm">
                <Select name="warehouse" options={opt.warehouses} defaultValue={f.warehouse ?? ""} placeholder="Pilih gudang" required />
              </div>
              <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Tampilkan lot</button>
            </form>
          </Card>

          {f.warehouse && (
            <Card title="2. Isi hasil hitung fisik" desc={`${lots.length} lot bersaldo`}>
              {lots.length === 0 ? (
                <Empty title="Tidak ada lot bersaldo di gudang ini" />
              ) : (
                <ActionForm action={createOpname} submit="Kirim untuk disetujui">
                  <input type="hidden" name="warehouse_id" value={f.warehouse} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Tanggal opname"><Input type="date" name="opname_date" defaultValue={today()} /></Field>
                    <Field label="Catatan" className="sm:col-span-2"><Input name="note" placeholder="Opsional" /></Field>
                  </div>
                  <Alert tone="blue">Kosongkan kolom hitung fisik bila berat sama dengan sistem. Isi alasan untuk setiap lot yang berselisih.</Alert>
                  <div className="-mx-5 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                          <th className="px-4 py-2.5">Lot / produk</th><th className="px-4 py-2.5 text-right">Sistem</th><th className="w-44 px-4 py-2.5">Hitung fisik (kg)</th><th className="px-4 py-2.5">Alasan selisih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lots.map((l: any) => (
                          <tr key={l.id}>
                            <td className="px-4 py-2">
                              <Two main={l.code} sub={`${l.product_name}${l.grade_name ? " · " + l.grade_name : ""}`} />
                              <input type="hidden" name="lot_id" value={l.id} /><input type="hidden" name="system_kg" value={l.balance_kg} />
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums">{kg(l.balance_kg)}</td>
                            <td className="px-4 py-2"><Input name="counted_kg" type="number" step="any" min="0" placeholder={String(l.balance_kg)} /></td>
                            <td className="px-4 py-2"><Input name="reason" placeholder="Wajib bila berselisih" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ActionForm>
              )}
            </Card>
          )}
          <p className="text-xs text-slate-500">Opname dari aplikasi gudang dapat menyertakan foto timbangan.</p>
        </div>
      )}
    </div>
  );
}