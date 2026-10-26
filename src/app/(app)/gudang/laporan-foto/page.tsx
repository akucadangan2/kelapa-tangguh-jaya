import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Card, Empty, PageHeader } from "@/components/ui";
import { ExportButtons } from "@/components/export-buttons";
import { PhotoGrid } from "@/components/photo-grid";
import { today, tgl } from "@/lib/format";

export const metadata = { title: "Laporan foto harian" };

const STAGES: [string, string][] = [
  ["purchase", "Pembelian"], ["goods_receipt", "Masuk gudang"], ["dispatch", "Keluar gudang"],
  ["factory_receipt", "Diterima pabrik"], ["production", "Produksi arang"], ["visit", "Kunjungan lapangan"], ["expense", "Pengeluaran"],
];
const LABEL = Object.fromEntries(STAGES);

const shift = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export default async function LaporanFoto({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const f = { date: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("ref_type, ref_id, kind, taken_at, verify_status, source")
    .gte("taken_at", `${f.date}T00:00:00+07:00`).lte("taken_at", `${f.date}T23:59:59+07:00`);
  const all = data ?? [];
  const stages = STAGES.filter(([t]) => (s.isOffice ? true : !["visit", "expense"].includes(t)))
    .map(([type, label]) => {
      const photos = all.filter((a: any) => a.ref_type === type);
      return { type, label, photos: photos.length, ids: [...new Set(photos.map((a: any) => a.ref_id))] };
    });
  const shown = stages.filter((x) => x.ids.length > 0 && (!f.stage || f.stage === x.type));
  const total = stages.reduce((a, x) => a + x.photos, 0);
  const isToday = f.date >= today();
  const link = (d: string, stage?: string) => `/gudang/laporan-foto?date=${d}${stage ? `&stage=${stage}` : ""}`;

  return (
    <div>
      <PageHeader title="Laporan foto harian" desc={`${tgl(f.date)} · ${total} foto`}>
        <ExportButtons filename={`laporan-foto-${f.date}`} rows={all.map((a: any) => ({ Tahap: LABEL[a.ref_type] ?? a.ref_type, Jenis: a.kind, Waktu: a.taken_at, Sumber: a.source, Status: a.verify_status }))} />
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={link(shift(f.date, -1), f.stage)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><ChevronLeft size={16} />Sebelumnya</Link>
        <form method="get" className="flex items-center gap-2">
          {f.stage && <input type="hidden" name="stage" value={f.stage} />}
          <input type="date" name="date" defaultValue={f.date} max={today()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none" />
          <button className="rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800">Lihat</button>
        </form>
        {!isToday && <Link href={link(shift(f.date, 1), f.stage)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">Berikutnya<ChevronRight size={16} /></Link>}
        {!isToday && <Link href={link(today(), f.stage)} className="px-2 text-sm font-semibold text-emerald-700 hover:underline">Hari ini</Link>}
      </div>

      {total > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href={link(f.date)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${!f.stage ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>Semua · {total}</Link>
          {stages.filter((x) => x.photos > 0).map((x) => (
            <Link key={x.type} href={link(f.date, x.type)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${f.stage === x.type ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
              {x.label} · {x.photos}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon={ImageOff} title="Tidak ada foto pada tanggal ini" desc="Foto dari aplikasi petugas dan gudang akan muncul di sini sesuai tanggal pengambilan." />
      ) : (
        <div className="space-y-5">
          {shown.map((x) => (
            <Card key={x.type} title={x.label} desc={`${x.ids.length} transaksi · ${x.photos} foto`}>
              <PhotoGrid refType={x.type} refIds={x.ids} title="" allowUpload={false} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}