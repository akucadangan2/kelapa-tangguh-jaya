import { BellRing } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, Field, Grid, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { runReminders, saveSettings } from "../actions";

export const metadata = { title: "Aturan sistem" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <div>
        <legend className="text-sm font-semibold text-slate-900">{title}</legend>
        {desc && <p className="text-xs text-slate-500">{desc}</p>}
      </div>
      {children}
    </fieldset>
  );
}

export default async function Aturan() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*");
  const v = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));

  return (
    <div>
      <PageHeader title="Aturan sistem" desc="Batas dan pengingat yang dipakai di seluruh website dan aplikasi" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ActionForm action={saveSettings} reset={false} submit="Simpan aturan">
              <div className="space-y-5">
                <Section title="Umum">
                  <Field label="Nama usaha"><Input name="company_name" defaultValue={v.company_name} /></Field>
                </Section>

                <Section title="Timbangan & barang" desc="Dipakai saat barang masuk gudang dan diterima pabrik">
                  <Grid cols={2}>
                    <Field label="Toleransi selisih timbang (%)" hint="Di atas angka ini muncul peringatan selisih"><Input name="weight_tolerance_pct" type="number" step="any" min="0" defaultValue={v.weight_tolerance_pct} /></Field>
                    <Field label="Batas barang di perjalanan (hari)" hint="Lewat batas ini mengunci pengajuan modal petugas"><Input name="transit_days" type="number" min="0" defaultValue={v.transit_days} /></Field>
                  </Grid>
                </Section>

                <Section title="Panjar & modal petugas">
                  <Grid cols={2}>
                    <Field label="Pengingat panjar terbuka (hari)" hint="Panjar yang belum selesai melewati batas ini akan diingatkan"><Input name="advance_open_days" type="number" min="0" defaultValue={v.advance_open_days} /></Field>
                    <Field label="Tenggat LPJ bawaan (hari)" hint="Dipakai saat modal disetujui"><Input name="lpj_default_days" type="number" min="0" defaultValue={v.lpj_default_days} /></Field>
                  </Grid>
                </Section>

                <Section title="Harga & foto">
                  <Grid cols={2}>
                    <Field label="Masa berlaku harga pabrik (jam)" hint="Lewat batas ini harga ditandai kedaluwarsa"><Input name="price_valid_hours" type="number" min="1" defaultValue={v.price_valid_hours} /></Field>
                  </Grid>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-sm transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/60">
                    <input type="checkbox" name="allow_gallery_upload" defaultChecked={v.allow_gallery_upload === true} className="mt-0.5 accent-emerald-600" />
                    <span>
                      <span className="font-medium text-slate-800">Izinkan petugas mengunggah foto dari galeri</span>
                      <span className="block text-xs text-slate-500">Foto dari galeri tetap ditandai “Unggahan galeri”.</span>
                    </span>
                  </label>
                </Section>
              </div>
            </ActionForm>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Pengingat otomatis">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><BellRing size={20} /></div>
              <p className="text-sm text-slate-600">Berjalan otomatis setiap hari pukul 07.00 WIB: panjar terbuka, LPJ terlambat, barang di perjalanan, stok minimal dan piutang jatuh tempo.</p>
            </div>
            <ActionForm action={runReminders} submit="Jalankan pengingat sekarang" variant="ghost"><span /></ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}