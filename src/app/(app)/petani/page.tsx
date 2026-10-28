import { CalendarClock, HandCoins, MapPin, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { MapView } from "@/components/map-view";
import { ExportButtons } from "@/components/export-buttons";
import { Collapse, QuickTabs, Two } from "@/components/page-bits";
import { SupplierForm } from "./supplier-form";
import { kg, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Petani & pemasok" };

const PRODUCTS: [string, string][] = [["KOPRA", "Kopra"], ["TEMPURUNG", "Tempurung"], ["ARANG", "Arang"]];
const P_LABEL = Object.fromEntries(PRODUCTS);
const days = (from: string, to: string) => Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);

export default async function PetaniPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = sp(await searchParams);
  const supabase = await createClient();
  const opt = await getOptions(["officers"]);
  const t = today();

  let q = supabase.from("suppliers").select("*, pic:pic_user_id(full_name)").eq("is_active", true).order("name");
  if (f.q) q = q.or(`name.ilike.%${f.q}%,address.ilike.%${f.q}%,region_label.ilike.%${f.q}%,phone.ilike.%${f.q}%`);
  if (f.product) q = q.contains("product_codes", [f.product]);
  if (f.pic) q = q.eq("pic_user_id", f.pic);
  const [{ data }, { data: bal }] = await Promise.all([q, supabase.from("v_supplier_balances").select("*")]);
  const balMap = new Map((bal ?? []).map((b: any) => [b.supplier_id, b]));
  let rows = (data ?? []).map((r: any) => ({ ...r, ...(balMap.get(r.id) ?? {}) }));
  const upcoming = (r: any) => r.pickup_date && r.pickup_date >= t && days(t, r.pickup_date) <= 7;
  const pickupCount = rows.filter(upcoming).length;
  if (f.view === "pickup") rows = rows.filter((r: any) => r.pickup_date).sort((a: any, b: any) => String(a.pickup_date).localeCompare(String(b.pickup_date)));
  const withGps = rows.filter((r: any) => r.lat && r.lng);
  const totalAdv = (bal ?? []).reduce((a: number, b: any) => a + Number(b.open_advance ?? 0), 0);
  const totalPay = (bal ?? []).reduce((a: number, b: any) => a + Number(b.payable ?? 0), 0);

  return (
    <div>
      <PageHeader title="Petani & pemasok" desc="Data pemasok, lokasi GPS, ketersediaan barang dan saldo panjar">
        <ExportButtons filename="petani" rows={rows.map((r: any) => ({
          Nama: r.name, HP: r.phone, Alamat: r.address, Barang: (r.product_codes ?? []).join(", "), Lat: r.lat, Lng: r.lng,
          "Perkiraan kg": r.est_weight_kg, "Batas harga": r.max_buy_price, Petugas: r.pic?.full_name, "Panjar terbuka": r.open_advance, "Utang": r.payable,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Jumlah petani" value={rows.length} hint={`${withGps.length} dengan lokasi GPS`} icon={Users} />
        <Stat label="Jadwal ambil 7 hari" value={pickupCount} hint="Termasuk hari ini" icon={CalendarClock} tone={pickupCount ? "blue" : "default"} href="/petani?view=pickup" />
        <Stat label="Panjar terbuka" value={rp(totalAdv)} icon={HandCoins} tone="amber" href="/pembelian/panjar" />
        <Stat label="Utang ke petani" value={rp(totalPay)} icon={Wallet} tone={totalPay > 0 ? "red" : "default"} href="/pembelian/panjar" />
      </div>

      <div className="space-y-5">
        <Collapse title="Tambah petani / pemasok" desc="Petugas lapangan juga dapat menambah petani dari aplikasi">
          <SupplierForm officers={opt.officers} />
        </Collapse>

        {withGps.length > 0 && (
          <Collapse title="Peta lokasi petani" desc={`${withGps.length} titik`} open>
            <MapView points={withGps.map((r: any) => ({
              id: r.id, lat: Number(r.lat), lng: Number(r.lng), title: r.name,
              subtitle: `${(r.product_codes ?? []).map((c: string) => P_LABEL[c] ?? c).join(", ")}${r.est_weight_kg ? ` · ${kg(r.est_weight_kg)}` : ""}`, href: `/petani/${r.id}`,
            }))} />
          </Collapse>
        )}

        <div>
          <QuickTabs items={[
            { label: "Semua", href: "/petani", active: !f.product && f.view !== "pickup" },
            ...PRODUCTS.map(([v, l]) => ({ label: l, href: `/petani?product=${v}`, active: f.product === v && f.view !== "pickup" })),
            { label: "Jadwal ambil", href: "/petani?view=pickup", active: f.view === "pickup", count: pickupCount },
          ]} />
          <FilterBar values={f} filters={[
            { name: "q", label: "Cari nama/alamat/HP", type: "text" },
            { name: "product", label: "Barang", type: "select", options: PRODUCTS.map(([value, label]) => ({ value, label })) },
            { name: "pic", label: "Petugas", type: "select", options: opt.officers },
          ]} />
          <Card padded={false}>
            <Table rows={rows} href={(r: any) => `/petani/${r.id}`} empty="Tidak ada petani untuk filter ini" cols={[
              {
                key: "name",
                label: "Petani",
                render: (r: any) => (
                  <Two
                    main={<span className="inline-flex items-center gap-1.5">{r.name}{r.lat && <MapPin size={13} className="text-emerald-500" />}</span>}
                    sub={[r.phone, r.region_label, r.address].filter(Boolean).join(" · ") || undefined}
                  />
                ),
              },
              {
                key: "product_codes",
                label: "Barang / perkiraan",
                render: (r: any) => (
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex flex-wrap gap-1">
                      {(r.product_codes ?? []).length ? (r.product_codes ?? []).map((c: string) => <Badge key={c} tone="gray" label={P_LABEL[c] ?? c} />) : <span className="text-slate-300">-</span>}
                    </div>
                    {r.est_weight_kg && <span className="text-xs text-slate-500">± {kg(r.est_weight_kg)}{r.est_sacks ? ` · ${r.est_sacks} karung` : ""}</span>}
                  </div>
                ),
              },
              {
                key: "pickup_date",
                label: "Jadwal ambil",
                render: (r: any) => {
                  if (!r.pickup_date) return <span className="text-slate-300">-</span>;
                  const d = days(t, r.pickup_date);
                  return <Two main={tgl(r.pickup_date)} sub={<span className={d < 0 ? "text-slate-400" : d <= 2 ? "font-semibold text-emerald-700" : ""}>{d < 0 ? `lewat ${-d} hari` : d === 0 ? "hari ini" : `${d} hari lagi`}</span>} />;
                },
              },
              { key: "max_buy_price", label: "Batas harga", align: "right", render: (r: any) => (r.max_buy_price ? <Two main={rp(r.max_buy_price)} sub={r.offer_price ? `tawar ${rp(r.offer_price)}` : undefined} /> : <span className="text-slate-300">-</span>) },
              { key: "pic", label: "Petugas", render: (r: any) => r.pic?.full_name ?? <span className="text-slate-300">-</span> },
              {
                key: "open_advance",
                label: "Panjar / utang",
                align: "right",
                render: (r: any) => {
                  const a = Number(r.open_advance ?? 0);
                  const p = Number(r.payable ?? 0);
                  if (!a && !p) return <span className="text-slate-300">-</span>;
                  return (
                    <div className="flex flex-col items-end leading-tight">
                      {a > 0 && <span className="font-semibold text-amber-700">{rp(a)}</span>}
                      {p > 0 && <span className="text-xs font-semibold text-red-600">utang {rp(p)}</span>}
                    </div>
                  );
                },
              },
            ]} />
          </Card>
        </div>
      </div>
    </div>
  );
}