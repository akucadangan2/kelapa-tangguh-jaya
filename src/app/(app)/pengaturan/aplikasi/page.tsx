import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { tgl } from "@/lib/format";
import { SITE } from "@/lib/site";
import { UploadApk } from "./upload";
import { deleteRelease } from "./actions";

const mb = (b: number | null) => (b ? (b / 1048576).toFixed(1) + " MB" : "-");

export default async function AplikasiPage() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data } = await supabase.from("app_releases").select("*").order("created_at", { ascending: false });
  const rows = data ?? [];

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/unduh`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Unduh aplikasi ${SITE.name} untuk karyawan:\n${link}\n\nLogin memakai akun yang diberikan admin.`)}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Aplikasi Android" desc="Unggah file APK untuk dipasang karyawan (petugas lapangan dan gudang)." />

      <Card title="Link unduhan karyawan">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">{link}</code>
          <a href="/unduh" target="_blank" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Buka halaman</a>
          <a href={share} target="_blank" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">Kirim lewat WhatsApp</a>
        </div>
        <p className="mt-2 text-xs text-slate-500">Halaman ini tidak muncul di Google dan tidak ditautkan dari halaman utama. Aplikasi hanya bisa dipakai dengan akun yang dibuat di menu Pengguna.</p>
      </Card>

      <Card title="Unggah versi baru">
        <UploadApk />
      </Card>

      <Card title="Riwayat versi">
        {rows.length === 0 ? (
          <Alert>Belum ada APK yang diunggah.</Alert>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r: any, i: number) => {
              const url = supabase.storage.from("apk").getPublicUrl(r.storage_path, { download: r.file_name }).data.publicUrl;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">Versi {r.version}</span>
                      {i === 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Terbaru</span>}
                    </div>
                    <div className="text-xs text-slate-500">{tgl(r.created_at)} · {mb(r.size_bytes)}</div>
                    {r.notes && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={url} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Unduh</a>
                    <ActionForm action={deleteRelease} inline submit="Hapus" variant="danger" confirm={`Hapus versi ${r.version}?`}>
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}