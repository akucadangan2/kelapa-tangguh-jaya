"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { run, ok, s, type ActionState } from "@/lib/action";

export async function deleteRelease(_: ActionState, fd: FormData) {
  return run(async () => {
    const ses = await getSession();
    if (!ses?.isOwner) throw new Error("Hanya pemilik/admin");
    const supabase = await createClient();
    const id = s(fd, "id")!;
    const row: any = ok(await supabase.from("app_releases").select("storage_path").eq("id", id).single());
    await supabase.storage.from("apk").remove([row.storage_path]);
    ok(await supabase.from("app_releases").delete().eq("id", id));
    revalidatePath("/pengaturan/aplikasi");
    revalidatePath("/unduh");
    return "Versi dihapus";
  });
}