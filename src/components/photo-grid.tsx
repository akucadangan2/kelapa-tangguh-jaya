import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ATTACH_KIND, jam } from "@/lib/format";
import { Badge } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { reviewAttachment, addAttachments } from "@/app/(app)/_actions/attachments";
import { Field, Input, Select } from "@/components/ui";

/** Daftar foto/bukti suatu transaksi, lengkap dengan waktu, GPS, sumber dan verifikasi admin. */
export async function PhotoGrid({ refType, refIds, title = "Foto & bukti", allowUpload = true, kinds }: {
  refType: string | string[]; refIds: string[]; title?: string; allowUpload?: boolean; kinds?: string[];
}) {
  const supabase = await createClient();
  const session = await getSession();
  const types = Array.isArray(refType) ? refType : [refType];
  if (refIds.length === 0) return null;
  const { data } = await supabase
    .from("attachments")
    .select("*, profiles:user_id(full_name)")
    .in("ref_type", types)
    .in("ref_id", refIds)
    .order("taken_at", { ascending: true });
  const rows = data ?? [];
  const paths = rows.map((r: any) => r.storage_path);
  const signed = paths.length ? (await supabase.storage.from("attachments").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = (p: string) => signed.find((x: any) => x.path === p)?.signedUrl;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {rows.length === 0 && <p className="text-sm text-slate-400">Belum ada foto.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {rows.map((a: any) => {
          const delayed = a.taken_at && new Date(a.received_at).getTime() - new Date(a.taken_at).getTime() > 10 * 60_000;
          return (
            <figure key={a.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs break-inside-avoid">
              {url(a.storage_path) ? (
                <a href={url(a.storage_path)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url(a.storage_path)} alt={a.kind} className="h-36 w-full object-cover" />
                </a>
              ) : <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-400">Tidak tersedia</div>}
              <figcaption className="space-y-1 p-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-slate-800">{ATTACH_KIND[a.kind] ?? a.kind}</span>
                  {a.source === "gallery" && <Badge tone="amber" label="Unggahan galeri" />}
                  {a.source === "web" && <Badge tone="gray" label="Unggah web" />}
                  <Badge status={a.verify_status} />
                </div>
                <div className="text-slate-500">Foto: {jam(a.taken_at)}</div>
                {delayed && <div className="text-amber-700">Diterima: {jam(a.received_at)}</div>}
                <div className="text-slate-500">{a.profiles?.full_name}</div>
                {a.lat && (
                  <a className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.lat},${a.lng}`}>
                    GPS {Number(a.lat).toFixed(5)}, {Number(a.lng).toFixed(5)}{a.gps_accuracy ? ` (±${Math.round(a.gps_accuracy)} m)` : ""}
                  </a>
                )}
                {a.note && <div className="text-slate-600">{a.note}</div>}
                {session?.isOffice && a.verify_status === "pending" && (
                  <div className="flex gap-1 pt-1 print:hidden">
                    <ActionForm action={reviewAttachment} submit="Valid" inline>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="valid" value="1" />
                    </ActionForm>
                    <ActionForm action={reviewAttachment} submit="Tolak" variant="danger" inline>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="valid" value="0" />
                    </ActionForm>
                  </div>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {allowUpload && session?.isOffice && refIds.length === 1 && (
        <details className="print:hidden">
          <summary className="cursor-pointer text-sm text-emerald-700">Tambah bukti dari komputer</summary>
          <ActionForm action={addAttachments} submit="Unggah" className="mt-2">
            <input type="hidden" name="ref_type" value={types[0]} />
            <input type="hidden" name="ref_id" value={refIds[0]} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Jenis">
                <Select name="kind" options={(kinds ?? Object.keys(ATTACH_KIND)).map((k) => ({ value: k, label: ATTACH_KIND[k] ?? k }))} />
              </Field>
              <Field label="File"><Input type="file" name="files" multiple accept="image/*,application/pdf" /></Field>
            </div>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
