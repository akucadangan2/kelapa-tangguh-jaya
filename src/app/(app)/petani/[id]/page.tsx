import { notFound } from "next/navigation";
import { HandCoins, MessageCircle, Navigation, ShoppingCart, Scale, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, Info, PageHeader, Stat, Table } from "@/components/ui";
import { MapView } from "@/components/map-view";
import { PhotoGrid } from "@/components/photo-grid";
import { BackLink, Collapse, QuickTabs, Two } from "@/components/page-bits";
import { SupplierForm } from "../supplier-form";
import { jam, kg, rp, tgl } from "@/lib/format";

export const metadata = { title: "Detail petani" };

const P_LABEL: Record<string, string> = { KOPRA: "Kopra", TEMPURUNG: "Tempurung", ARANG: "Arang" };
const btn = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";

export default async function SupplierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const { id } = await params;
  const f = sp(await searchParams);
  const tab = ["panjar", "kunjungan", "ubah"].includes(f.tab) ? f.tab : "beli";
  const supabase = await createClient();
  const { data: s } = await supabase.from("suppliers").select("*, pic:pic_user_id(full_name)").eq("id", id).single();
  if (!s) notFound();
  const [visits, purchases, advances, bal, opt] = await Promise.all([
    supabase.from("supplier_visits").select("*, products(name), profiles:user_id(full_name)").eq("supplier_id", id).order("visited_at", { ascending: false }),
    supabase.from("purchases").select("*, products(name), quality_grades(name)").eq("supplier_id", id).order("purchase_date", { ascending: false }),
    supabase.from("advances").select("*").eq("supplier_id", id).order("given_at", { ascending: false }),
    supabase.from("v_supplier_balances").select("*").eq("supplier_id", id).maybeSingle(),
    getOptions(["officers"]),
  ]);
  const pur = purchases.data ?? [];
  const act = pur.filter((p: any) => p.status !== "cancelled");
  const totalBuy = act.reduce((a: number, p: any) => a + Number(p.total_amount), 0);
  const totalKg = act.reduce((a: number, p: any) => a + Number(p.agreed_kg), 0);
  const vis = visits.data ?? [];
  const adv = advances.data ?? [];
  const wa = s.phone ? `https://wa.me/${s.phone.replace(/^0/, "62").replace(/\D/g, "")}` : null;
  const base = `/petani/${id}`;

  return (
    <div>
      <BackLink href="/petani" label="Petani" />
      <PageHeader title={s.name} desc={[s.address, s.pic?.full_name ? `PJ ${s.pic.full_name}` : null].filter(Boolean).join(" · ")}>
        {wa && <a className={btn} target="_blank" rel="noreferrer" href={wa}><MessageCircle size={16} className="text-emerald-600" />WhatsApp</a>}
        {s.lat && <a className={btn} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}><Navigation size={16} className="text-sky-600" />Navigasi</a>}
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total pembelian" value={rp(totalBuy)} hint={`${act.length} transaksi`} icon={ShoppingCart} tone="green" />
        <Stat label="Total berat" value={kg(totalKg)} hint={totalKg ? `Rata-rata ${rp(totalBuy / totalKg)}/kg` : undefined} icon={Scale} />
        <Stat label="Panjar terbuka" value={rp(bal.data?.open_advance)} icon={HandCoins} tone={Number(bal.data?.open_advance) > 0 ? "amber" : "default"} />
        <Stat label="Utang ke petani" value={rp(bal.data?.payable)} icon={Wallet} tone={Number(bal.data?.payable) > 0 ? "red" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickTabs items={[
            { label: "Pembelian", href: base, active: tab === "beli", count: pur.length },
            { label: "Panjar", href: `${base}?tab=panjar`, active: tab === "panjar", count: adv.length },
            { label: "Kunjungan", href: `${base}?tab=kunjungan`, active: tab === "kunjungan", count: vis.length },
            { label: "Ubah data", href: `${base}?tab=ubah`, active: tab === "ubah" },
          ]} />

          {tab === "beli" && (
            <Card padded={false}>
              <Table rows={pur} href={(r: any) => `/pembelian/${r.id}`} empty="Belum ada pembelian" cols={[
                { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.purchase_date)} /> },
                { key: "products", label: "Barang", render: (r: any) => <Two main={r.products?.name} sub={r.quality_grades?.name} /> },
                { key: "agreed_kg", label: "Berat", align: "right", render: (r: any) => <Two main={kg(r.agreed_kg)} sub={`${rp(r.price_per_kg)}/kg`} /> },
                { key: "total_amount", label: "Total", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.total_amount)}</span> },
                { key: "balance_due", label: "Sisa utang", align: "right", render: (r: any) => (Number(r.balance_due) > 0 ? <span className="font-semibold text-red-600">{rp(r.balance_due)}</span> : <span className="text-slate-300">-</span>) },
                { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
              ]} />
            </Card>
          )}

          {tab === "panjar" && (
            <Card padded={false}>
              <Table rows={adv} empty="Belum ada panjar" cols={[
                { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.given_at)} /> },
                { key: "amount", label: "Diberikan", align: "right", render: (r: any) => rp(r.amount) },
                { key: "allocated_amount", label: "Dipotong", align: "right", render: (r: any) => (Number(r.allocated_amount) ? rp(r.allocated_amount) : "-") },
                { key: "returned_amount", label: "Kembali", align: "right", render: (r: any) => (Number(r.returned_amount) ? rp(r.returned_amount) : "-") },
                { key: "remaining", label: "Sisa", align: "right", render: (r: any) => <span className={`font-semibold ${Number(r.remaining) > 0 ? "text-amber-700" : "text-slate-400"}`}>{rp(r.remaining)}</span> },
                { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
              ]} />
            </Card>
          )}

          {tab === "kunjungan" && (
            <Card padded={false}>
              <Table rows={vis} empty="Belum ada kunjungan" cols={[
                { key: "visited_at", label: "Waktu / petugas", render: (r: any) => <Two main={jam(r.visited_at)} sub={r.profiles?.full_name} /> },
                { key: "products", label: "Barang", render: (r: any) => <Two main={r.products?.name ?? "-"} sub={r.est_weight_kg ? `± ${kg(r.est_weight_kg)}` : undefined} /> },
                { key: "offer_price", label: "Harga tawar", align: "right", render: (r: any) => (r.offer_price ? rp(r.offer_price) : "-") },
                { key: "pickup_date", label: "Jadwal ambil", render: (r: any) => tgl(r.pickup_date) },
                { key: "notes", label: "Catatan", render: (r: any) => <span className="text-slate-500">{r.notes || "-"}</span> },
              ]} />
            </Card>
          )}

          {tab === "ubah" && (
            <Card title="Ubah data petani">
              <SupplierForm supplier={s} officers={opt.officers} />
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card title="Profil">
            <Info items={[
              ["HP", s.phone || "-"], ["Wilayah", s.region_label || "-"],
              ["Barang", (s.product_codes ?? []).length ? <span key="b" className="inline-flex flex-wrap gap-1">{(s.product_codes ?? []).map((c: string) => <Badge key={c} tone="gray" label={P_LABEL[c] ?? c} />)}</span> : "-"],
              ["Perkiraan", s.est_weight_kg ? `${kg(s.est_weight_kg)} / ${s.est_sacks ?? "-"} karung` : "-"],
              ["Jadwal ambil", tgl(s.pickup_date)],
              ["Harga penawaran", s.offer_price ? rp(s.offer_price) : "-"],
              ["Batas harga beli", s.max_buy_price ? rp(s.max_buy_price) : "-"],
              ["Akses kendaraan", s.vehicle_access || "-"],
              ["Petunjuk jalan", s.directions || "-"],
              ["GPS", s.lat ? `${s.lat}, ${s.lng}${s.gps_accuracy ? ` (±${Math.round(s.gps_accuracy)} m)` : ""}` : "-"],
              ...(s.notes ? [["Catatan", s.notes] as [string, any]] : []),
            ]} />
          </Card>
          {s.lat ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
              <MapView height={240} points={[{ id: s.id, lat: Number(s.lat), lng: Number(s.lng), title: s.name }]} />
            </div>
          ) : (
            <Card><p className="text-sm text-slate-400">Lokasi GPS belum tersedia. Petugas dapat merekam lokasi dari aplikasi saat kunjungan.</p></Card>
          )}
          <Collapse title="Foto lokasi & kunjungan" desc={`${vis.length} kunjungan`}>
            <PhotoGrid refType={["supplier", "visit"]} refIds={[s.id, ...vis.map((v: any) => v.id)]} title="" allowUpload={false} />
          </Collapse>
        </div>
      </div>
    </div>
  );
}