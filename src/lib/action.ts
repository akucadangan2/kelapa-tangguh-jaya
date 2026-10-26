import { unstable_rethrow } from "next/navigation";

export type ActionState = { error?: string; ok?: string; t?: number } | null;

/** Bungkus server action: pesan error dari database (RAISE EXCEPTION) diteruskan ke form. */
export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const msg = await fn();
    return { ok: msg || "Tersimpan", t: Date.now() };
  } catch (e: any) {
    unstable_rethrow(e);
    return { error: e?.message ?? "Terjadi kesalahan", t: Date.now() };
  }
}

/** Lempar error jika query Supabase gagal. */
export function ok<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === null || String(v).trim() === "" ? null : String(v).trim();
};
export const n = (fd: FormData, k: string) => {
  const v = s(fd, k);
  if (v === null) return null;
  const x = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
};
export const b = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** Unggah file dari website ke storage + catat di tabel attachments. */
export async function uploadAttachments(supabase: any, userId: string, files: File[], refType: string, refId: string, kind: string) {
  for (const file of files) {
    if (!file || !file.size) continue;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${refType}/${refId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(up.error.message);
    ok(await supabase.from("attachments").insert({
      ref_type: refType, ref_id: refId, kind, storage_path: path, source: "web", user_id: userId, taken_at: new Date().toISOString(),
    }));
  }
}
