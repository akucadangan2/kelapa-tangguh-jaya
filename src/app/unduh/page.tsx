import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";
import { tgl } from "@/lib/format";
import logo from "../logo.png";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Unduh Aplikasi · ${SITE.name}`,
  robots: { index: false, follow: false },
};

const STEPS = [
  "Ketuk tombol Unduh APK di atas dan tunggu sampai selesai.",
  "Buka file yang sudah diunduh. Bila muncul peringatan, pilih Setelan lalu aktifkan Izinkan dari sumber ini.",
  "Ketuk Instal, lalu buka aplikasi.",
  "Login memakai email dan password yang diberikan admin.",
];

export default async function UnduhPage() {
  const supabase = await createClient();
  const { data: r } = await supabase.from("app_releases").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const url = r ? supabase.storage.from("apk").getPublicUrl(r.storage_path, { download: r.file_name }).data.publicUrl : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <Image src={logo} alt={SITE.name} width={88} height={88} className="mx-auto h-22 w-22 rounded-2xl object-contain" priority />
          <h1 className="mt-4 text-xl font-bold text-slate-900">{SITE.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Aplikasi khusus karyawan: petugas lapangan dan gudang</p>

          {r && url ? (
            <>
              <a href={url} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-semibold text-white hover:bg-emerald-800">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
                Unduh APK
              </a>
              <p className="mt-2 text-xs text-slate-500">
                Versi {r.version} · {r.size_bytes ? (r.size_bytes / 1048576).toFixed(1) + " MB" : ""} · {tgl(r.created_at)}
              </p>
            </>
          ) : (
            <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Aplikasi belum tersedia. Hubungi admin.</p>
          )}
        </div>

        {r?.notes && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800">Yang baru di versi {r.version}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{r.notes}</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">Cara memasang</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Untuk memperbarui, unduh versi terbaru dari halaman ini lalu instal di atas aplikasi lama. Data tetap aman karena tersimpan di server. Saat ini aplikasi hanya tersedia untuk Android.
          </p>
        </div>
      </div>
    </main>
  );
}