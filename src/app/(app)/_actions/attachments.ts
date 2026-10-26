"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, uploadAttachments, type ActionState } from "@/lib/action";

export async function reviewAttachment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.rpc("review_attachment", { p_id: s(fd, "id"), p_valid: s(fd, "valid") === "1", p_note: s(fd, "note") }));
    revalidatePath("/", "layout");
    return "Diperbarui";
  });
}

export async function addAttachments(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const files = fd.getAll("files") as File[];
    await uploadAttachments(supabase, user!.id, files, s(fd, "ref_type")!, s(fd, "ref_id")!, s(fd, "kind") ?? "other");
    revalidatePath("/", "layout");
    return "Bukti diunggah";
  });
}

export async function markNotificationsRead(_: ActionState, _fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    ok(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null));
    revalidatePath("/", "layout");
    return "Ditandai dibaca";
  });
}
