import { ActionForm } from "@/components/action-form";
import { Field, Grid, Input, Select, Textarea } from "@/components/ui";
import { RegionPicker } from "@/components/region-picker";
import { saveSupplier } from "./actions";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SupplierForm({ supplier, officers }: { supplier?: any; officers: { value: string; label: string }[] }) {
  const v = supplier ?? {};
  const codes: string[] = v.product_codes ?? [];
  return (
    <ActionForm action={saveSupplier} reset={!supplier} submit={supplier ? "Simpan perubahan" : "Simpan petani"}>
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="space-y-6">
        <Section title="Identitas">
          <Grid>
            <Field label="Nama petani/pemasok"><Input name="name" defaultValue={v.name} required /></Field>
            <Field label="No. HP / WhatsApp"><Input name="phone" defaultValue={v.phone} inputMode="tel" /></Field>
            <Field label="Petugas penanggung jawab"><Select name="pic_user_id" defaultValue={v.pic_user_id ?? ""} options={officers} placeholder="-" /></Field>
          </Grid>
        </Section>

        <Section title="Lokasi">
          <RegionPicker value={v} />
          <Grid>
            <Field label="Alamat detail (jalan, dusun, jaga)" className="sm:col-span-2"><Input name="address" defaultValue={v.address} /></Field>
            <Field label="Akses kendaraan"><Input name="vehicle_access" defaultValue={v.vehicle_access} placeholder="Truk / pikap / motor" /></Field>
            <Field label="Latitude"><Input name="lat" defaultValue={v.lat} placeholder="1.4" inputMode="decimal" /></Field>
            <Field label="Longitude"><Input name="lng" defaultValue={v.lng} placeholder="124.8" inputMode="decimal" /></Field>
            <Field label="Petunjuk jalan"><Input name="directions" defaultValue={v.directions} /></Field>
          </Grid>
        </Section>

        <Section title="Barang & harga">
          <Field label="Barang tersedia">
            <div className="flex flex-wrap gap-2">
              {[["KOPRA", "Kopra"], ["TEMPURUNG", "Tempurung"], ["ARANG", "Arang"]].map(([c, l]) => (
                <label key={c} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800">
                  <input type="checkbox" name="product_codes" value={c} defaultChecked={codes.includes(c)} className="accent-emerald-600" /> {l}
                </label>
              ))}
            </div>
          </Field>
          <Grid>
            <Field label="Perkiraan berat (kg)"><Input name="est_weight_kg" type="number" step="any" min="0" defaultValue={v.est_weight_kg} /></Field>
            <Field label="Perkiraan karung"><Input name="est_sacks" type="number" min="0" defaultValue={v.est_sacks} /></Field>
            <Field label="Jadwal ambil"><Input name="pickup_date" type="date" defaultValue={v.pickup_date} /></Field>
            <Field label="Harga penawaran petani (Rp/kg)"><Input name="offer_price" type="number" step="any" min="0" defaultValue={v.offer_price} /></Field>
            <Field label="Batas harga beli disetujui (Rp/kg)"><Input name="max_buy_price" type="number" step="any" min="0" defaultValue={v.max_buy_price} /></Field>
          </Grid>
        </Section>

        <Section title="Catatan">
          <Textarea name="notes" defaultValue={v.notes} rows={3} />
        </Section>
      </div>
    </ActionForm>
  );
}