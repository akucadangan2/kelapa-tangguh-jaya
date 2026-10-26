import { BadgeCheck, Clock, Factory, TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Alert, Badge, Card, Empty, Field, Grid, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { Collapse, QuickTabs, Two } from "@/components/page-bits";
import { jam, rp } from "@/lib/format";
import { addPrice, saveFactory } from "./actions";

export const metadata = { title: "Pabrik & harga" };

const PRICE_LABEL: Record<string, string> = { confirmed: "Terkonfirmasi", indicative: "Indikatif", expired: "Kedaluwarsa" };
const PRICE_TONE: Record<string, "green" | "amber" | "red"> = { confirmed: "green", indicative: "amber", expired: "red" };

export default async function PabrikPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse", "field");
  if (!s.isOffice && !s.canSellPrice) return <Alert tone="red">Akses harga jual diatur oleh pemilik.</Alert>;
  const f = sp(await searchParams);
  const supabase = await createClient();
  const opt = await getOptions(["factories", "products"]);
  const [{ data: current }, { data: history }, { data: setting }] = await Promise.all([
    supabase.from("v_factory_prices_current").select("*").order("product_name").order("net_per_kg", { ascending: false }),
    supabase.from("factory_prices").select("*, factories(name), products(name), profiles:updated_by(full_name)").order("confirmed_at", { ascending: false }).limit(100),
    supabase.from("settings").select("value").eq("key", "price_valid_hours").maybeSingle(),
  ]);
  const allCur = current ?? [];
  const cur = allCur.filter((r: any) => !f.product || r.product_id === f.product);
  const products = [...new Set(cur.map((r: any) => r.product_name as string))];
  const factories = new Set(allCur.map((r: any) => r.factory_name)).size;
  const confirmed = allCur.filter((r: any) => r.price_status === "confirmed").length;
  const expired = allCur.filter((r: any) => r.price_status === "expired").length;
  const lastUpdate = (history ?? [])[0];

  const priceForm = (
    <ActionForm action={addPrice} submit="Simpan harga">
      <Field label="Pabrik"><Select name="factory_id" options={opt.factories} required placeholder="Pilih pabrik" /></Field>
      <Grid cols={2}>
        <Field label="Produk"><Select name="product_id" options={opt.products} required placeholder="Pilih" /></Field>
        <Field label="Harga (Rp/kg)"><Input name="price_per_kg" type="number" step="any" min="0" required /></Field>
      </Grid>
      <Field label="Basis penyerahan"><Select name="delivery_basis" options={[{ value: "franco", label: "Franco pabrik (kita antar)" }, { value: "loco", label: "Loco gudang (pabrik ambil)" }]} /></Field>
      <Grid cols={2}>
        <Field label="Ongkir (Rp/kg)"><Input name="freight_per_kg" type="number" step="any" min="0" /></Field>
        <Field label="Potongan (%)"><Input name="deduction_pct" type="number" step="any" min="0" /></Field>
        <Field label="Tempo bayar (hari)"><Input name="payment_term_days" type="number" min="0" /></Field>
        <Field label="Status"><Select name="confirmation" options={[{ value: "confirmed", label: "Terkonfirmasi" }, { value: "indicative", label: "Indikatif" }]} /></Field>
        <Field label="Berlaku sampai" hint={`Kosong = ${setting?.value ?? 24} jam`}><Input name="valid_until" type="date" /></Field>
        <Field label="Sumber"><Input name="source" placeholder="Telepon / WA / surat" /></Field>
      </Grid>
      <input type="hidden" name="valid_hours" value={String(setting?.value ?? 24)} />
      <Field label="Potongan & syarat penerimaan"><Textarea name="conditions" rows={2} /></Field>
      <Field label="Bukti (foto/tangkapan layar)"><Input type="file" name="files" multiple accept="image/*,application/pdf" /></Field>
    </ActionForm>
  );

  return (
    <div>
      <PageHeader title="Pabrik & harga terkini" desc="Harga diperbarui petugas berwenang setelah konfirmasi pabrik">
        <ExportButtons filename="harga-pabrik" rows={cur.map((r: any) => ({
          Pabrik: r.factory_name, Produk: r.product_name, "Harga/kg": r.price_per_kg, Basis: r.delivery_basis, "Ongkir/kg": r.freight_per_kg,
          "Potongan %": r.deduction_pct, "Hasil bersih/kg": r.net_per_kg, "Tempo (hari)": r.payment_term_days, Status: r.price_status, Dikonfirmasi: r.confirmed_at, "Berlaku s/d": r.valid_until, Sumber: r.source,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Pabrik dengan harga" value={factories} icon={Factory} />
        <Stat label="Harga terkonfirmasi" value={confirmed} hint={`dari ${allCur.length} harga`} icon={BadgeCheck} tone="green" />
        <Stat label="Kedaluwarsa" value={expired} hint="Perlu dikonfirmasi ulang" icon={Clock} tone={expired ? "red" : "default"} />
        <Stat label="Pembaruan terakhir" value={lastUpdate ? jam(lastUpdate.confirmed_at) : "-"} hint={lastUpdate ? `${lastUpdate.factories?.name ?? ""} · ${lastUpdate.products?.name ?? ""}` : undefined} icon={TrendingUp} tone="blue" />
      </div>

      <div className={s.isOffice ? "grid gap-5 lg:grid-cols-3" : ""}>
        <div className={s.isOffice ? "space-y-5 lg:col-span-2" : "space-y-5"}>
          <QuickTabs items={[
            { label: "Semua produk", href: "/pabrik", active: !f.product },
            ...opt.products.map((p) => ({ label: p.label, href: `/pabrik?product=${p.value}`, active: f.product === p.value })),
          ]} />
          <Alert tone="blue">Status harga: terkonfirmasi, indikatif atau kedaluwarsa. Harga tidak ditampilkan sebagai “live” karena belum ada sumber yang terhubung langsung ke pabrik.</Alert>

          {products.length === 0 && <Empty icon={Factory} title="Belum ada harga pabrik" desc="Harga yang disimpan akan tampil di sini, diurutkan dari hasil bersih tertinggi." />}

          {products.map((p) => {
            const list = cur.filter((r: any) => r.product_name === p);
            const best = list.find((r: any) => r.price_status !== "expired");
            return (
              <Card key={p} title={p} desc={`${list.length} pabrik · urut dari hasil bersih tertinggi`} padded={false}>
                <Table rows={list} cols={[
                  { key: "factory_name", label: "Pabrik", render: (r: any) => <Two main={<span className="inline-flex items-center gap-1.5">{r.factory_name}{best && r === best && <Badge tone="green" label="Terbaik" />}</span>} sub={r.factory_location} /> },
                  { key: "price_per_kg", label: "Harga/kg", align: "right", render: (r: any) => <Two main={rp(r.price_per_kg)} sub={r.delivery_basis === "franco" ? "Franco pabrik" : "Loco gudang"} /> },
                  { key: "freight_per_kg", label: "Ongkir · potongan", align: "right", render: (r: any) => <Two main={rp(r.freight_per_kg)} sub={`potongan ${r.deduction_pct ?? 0}%`} /> },
                  { key: "net_per_kg", label: "Bersih/kg", align: "right", render: (r: any) => <span className="font-bold text-emerald-700">{rp(r.net_per_kg)}</span> },
                  { key: "payment_term_days", label: "Tempo", align: "right", render: (r: any) => `${r.payment_term_days ?? 0} hari` },
                  { key: "price_status", label: "Status", render: (r: any) => <Two main={<Badge tone={PRICE_TONE[r.price_status] ?? "gray"} label={PRICE_LABEL[r.price_status] ?? r.price_status} />} sub={`${jam(r.confirmed_at)}${r.source ? ` · ${r.source}` : ""}`} /> },
                ]} />
              </Card>
            );
          })}

          <Collapse title="Riwayat pembaruan harga" desc={`${(history ?? []).length} catatan terakhir`}>
            <div className="-m-5">
              <Table rows={history ?? []} empty="Belum ada riwayat" cols={[
                { key: "confirmed_at", label: "Waktu", render: (r: any) => <span className="whitespace-nowrap">{jam(r.confirmed_at)}</span> },
                { key: "factories", label: "Pabrik / produk", render: (r: any) => <Two main={r.factories?.name} sub={r.products?.name} /> },
                { key: "price_per_kg", label: "Harga/kg", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.price_per_kg)}</span> },
                { key: "confirmation", label: "Status", render: (r: any) => <Badge tone={r.confirmation === "confirmed" ? "green" : "amber"} label={r.confirmation === "confirmed" ? "Terkonfirmasi" : "Indikatif"} /> },
                { key: "profiles", label: "Sumber / oleh", render: (r: any) => <Two main={r.source || "-"} sub={r.profiles?.full_name} /> },
              ]} />
            </div>
          </Collapse>
        </div>

        {s.isOffice && (
          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Card title="Perbarui harga pabrik" desc="Simpan setelah harga dikonfirmasi pabrik">{priceForm}</Card>
            <Collapse title="Tambah pabrik" desc="Data pabrik tujuan penjualan">
              <ActionForm action={saveFactory}>
                <Field label="Nama pabrik"><Input name="name" required /></Field>
                <Field label="Lokasi"><Input name="location" /></Field>
                <Grid cols={2}>
                  <Field label="Kontak"><Input name="contact_name" /></Field>
                  <Field label="Telepon"><Input name="phone" /></Field>
                  <Field label="Latitude"><Input name="lat" /></Field>
                  <Field label="Longitude"><Input name="lng" /></Field>
                </Grid>
                <Field label="Produk yang dibeli">
                  <div className="flex flex-wrap gap-2">
                    {[["KOPRA", "Kopra"], ["TEMPURUNG", "Tempurung"], ["ARANG", "Arang"]].map(([c, l]) => (
                      <label key={c} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                        <input type="checkbox" name="product_codes" value={c} className="accent-emerald-600" /> {l}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Spesifikasi mutu"><Textarea name="quality_spec" rows={2} /></Field>
              </ActionForm>
            </Collapse>
          </div>
        )}
      </div>
    </div>
  );
}