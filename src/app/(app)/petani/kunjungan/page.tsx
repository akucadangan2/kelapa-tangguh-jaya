import { ClipboardList, Scale, UserCheck, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { MapView } from "@/components/map-view";
import { Collapse, Two } from "@/components/page-bits";
import { jam, kg, monthStart, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Kunjungan lapangan" };

function Gps({ r }: { r: any }) {
  if (!r.lat) return <span className="text-slate-300">-</span>;
  const acc = Math.round(Number(r.gps_accuracy ?? 0));
  const cls = acc <= 30 ? "bg-emerald-50 text-emerald-700" : acc <= 100 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>±{acc} m</span>;
}

export default async function Kunjungan({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = { from: monthStart(), to: today(), ...sp(await searchParams) } as Record<string, string>;
  const supabase = await createClient();
  const opt = await getOptions(["officers"]);
  let q = supabase.from("supplier_visits").select("*, suppliers(id, name), products(name), profiles:user_id(full_name)")
    .gte("visited_at", f.from).lte("visited_at", f.to + "T23:59:59+07:00").order("visited_at", { ascending: false });
  if (f.user) q = q.eq("user_id", f.user);
  const { data } = await q;
  const rows = data ?? [];
  const suppliers = new Set(rows.map((r: any) => r.suppliers?.id).filter(Boolean)).size;
  const officers = new Set(rows.map((r: any) => r.user_id).filter(Boolean)).size;
  const estKg = rows.reduce((a: number, r: any) => a + Number(r.est_weight_kg ?? 0), 0);
  const withGps = rows.filter((r: any) => r.lat && r.lng);

  return (
    <div>
      <PageHeader title="Kunjungan & survei lapangan" desc={`Laporan kunjungan petugas dengan GPS dan foto · ${tgl(f.from)} – ${tgl(f.to)}`}>
        <ExportButtons filename="kunjungan" rows={rows.map((r: any) => ({
          Waktu: jam(r.visited_at), Petugas: r.profiles?.full_name, Petani: r.suppliers?.name, Barang: r.products?.name,
          "Perkiraan kg": r.est_weight_kg, Karung: r.est_sacks, "Harga tawar": r.offer_price, "Jadwal ambil": r.pickup_date, Lat: r.lat, Lng: r.lng, "Akurasi (m)": r.gps_accuracy, Catatan: r.notes,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Jumlah kunjungan" value={rows.length} hint={`${withGps.length} dengan GPS`} icon={ClipboardList} />
        <Stat label="Petani dikunjungi" value={suppliers} icon={Users} tone="blue" />
        <Stat label="Perkiraan berat" value={kg(estKg)} hint="Total dari laporan kunjungan" icon={Scale} tone="green" />
        <Stat label="Petugas aktif" value={officers} icon={UserCheck} tone="violet" />
      </div>

      <FilterBar values={f} filters={[
        { name: "from", label: "Dari", type: "date" }, { name: "to", label: "Sampai", type: "date" },
        { name: "user", label: "Petugas", type: "select", options: opt.officers },
      ]} />

      <div className="space-y-5">
        {withGps.length > 0 && (
          <Collapse title="Peta kunjungan" desc={`${withGps.length} titik`} open>
            <MapView points={withGps.map((r: any) => ({ id: r.id, lat: Number(r.lat), lng: Number(r.lng), title: r.suppliers?.name, subtitle: `${r.profiles?.full_name ?? ""} · ${jam(r.visited_at)}`, href: `/petani/${r.suppliers?.id}` }))} />
          </Collapse>
        )}

        <Card padded={false}>
          <Table rows={rows} href={(r: any) => `/petani/${r.suppliers?.id}`} empty="Tidak ada kunjungan pada periode ini" cols={[
            { key: "suppliers", label: "Petani / waktu", render: (r: any) => <Two main={r.suppliers?.name} sub={jam(r.visited_at)} /> },
            { key: "profiles", label: "Petugas", render: (r: any) => r.profiles?.full_name ?? "-" },
            { key: "products", label: "Barang / perkiraan", render: (r: any) => <Two main={r.products?.name ?? "-"} sub={r.est_weight_kg ? `± ${kg(r.est_weight_kg)}${r.est_sacks ? ` · ${r.est_sacks} karung` : ""}` : undefined} /> },
            { key: "offer_price", label: "Harga tawar", align: "right", render: (r: any) => (r.offer_price ? rp(r.offer_price) : <span className="text-slate-300">-</span>) },
            { key: "pickup_date", label: "Jadwal ambil", render: (r: any) => (r.pickup_date ? tgl(r.pickup_date) : <span className="text-slate-300">-</span>) },
            { key: "gps_accuracy", label: "GPS", render: (r: any) => <Gps r={r} /> },
            { key: "notes", label: "Catatan", render: (r: any) => <span className="text-slate-500">{r.notes || "-"}</span> },
          ]} />
        </Card>
      </div>
    </div>
  );
}