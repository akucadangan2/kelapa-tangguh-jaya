"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, Input, Textarea } from "@/components/ui";
import { SITE } from "@/lib/site";

export function UploadApk() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    const version = String(fd.get("version") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim() || null;

    if (!file || !file.size) return setMsg({ error: "Pilih file APK" });
    if (!file.name.toLowerCase().endsWith(".apk")) return setMsg({ error: "File harus berformat .apk" });
    if (file.size > 50 * 1024 * 1024) return setMsg({ error: "Ukuran maksimal 50 MB. Build ulang dengan --split-per-abi" });
    if (!/^\d+\.\d+\.\d+$/.test(version)) return setMsg({ error: "Versi harus berformat 1.0.0" });

    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const path = `releases/${version}-${crypto.randomUUID().slice(0, 8)}.apk`;
    const up = await supabase.storage.from("apk").upload(path, file, {
      contentType: "application/vnd.android.package-archive",
      upsert: false,
    });
    if (up.error) {
      setBusy(false);
      return setMsg({ error: up.error.message });
    }
    const ins = await supabase.from("app_releases").insert({
      version,
      notes,
      storage_path: path,
      file_name: `${SITE.name.replace(/\s+/g, "")}-${version}.apk`,
      size_bytes: file.size,
    });
    setBusy(false);
    if (ins.error) {
      await supabase.storage.from("apk").remove([path]);
      return setMsg({ error: ins.error.message });
    }
    form.reset();
    setMsg({ ok: `Versi ${version} berhasil diunggah` });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="File APK" hint="build\app\outputs\flutter-apk\app-arm64-v8a-release.apk">
          <Input type="file" name="file" accept=".apk,application/vnd.android.package-archive" required />
        </Field>
        <Field label="Versi" hint="Sama dengan version di pubspec.yaml, contoh 1.0.1">
          <Input name="version" placeholder="1.0.0" required />
        </Field>
      </div>
      <Field label="Catatan perubahan (opsional)">
        <Textarea name="notes" rows={3} placeholder="Contoh: perbaikan cetak struk, tambah panduan aplikasi" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
          {busy ? "Mengunggah..." : "Unggah"}
        </button>
        {msg?.error && <span className="text-sm text-red-600">{msg.error}</span>}
        {msg?.ok && <span className="text-sm text-emerald-700">{msg.ok}</span>}
      </div>
    </form>
  );
}