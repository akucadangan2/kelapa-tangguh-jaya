"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, b, type ActionState } from "@/lib/action";

const refresh = (id?: string | null) => {
  revalidatePath("/modal");
  if (id) revalidatePath(`/modal/${id}`);
};

export async function approveAssignment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const id = s(fd, "id");
    const items = fd.getAll("item_id").map((itemId, i) => ({ id: String(itemId), approved_max_price: Number(fd.getAll("item_price")[i] || 0) || null }));
    ok(await supabase.rpc("approve_assignment", { p_id: id, p_amount: n(fd, "amount"), p_due: s(fd, "due_date"), p_items: items, p_note: s(fd, "note") }));
    refresh(id);
    return "Pengajuan disetujui";
  });
}

export async function rejectAssignment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.rpc("reject_assignment", { p_id: s(fd, "id"), p_note: s(fd, "note") }));
    refresh(s(fd, "id"));
    return "Pengajuan ditolak";
  });
}

export async function disburseAssignment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const id = s(fd, "id");
    const { data: trf, error } = await supabase.rpc("disburse_assignment", {
      p_id: id, p_from: s(fd, "from_account_id"), p_amount: n(fd, "amount"), p_date: s(fd, "date"), p_note: s(fd, "note"),
    });
    if (error) throw new Error(error.message);
    const files = fd.getAll("files") as File[];
    if (files.some((f) => f.size)) {
      const { data: { user } } = await supabase.auth.getUser();
      const { uploadAttachments } = await import("@/lib/action");
      await uploadAttachments(supabase, user!.id, files, "transfer", trf as string, "transfer");
    }
    refresh(id);
    return "Dana dicairkan ke kas petugas";
  });
}

export async function recordReturn(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const id = s(fd, "id");
    ok(await supabase.from("cash_transfers").insert({
      type: "return", from_account_id: s(fd, "from_account_id"), to_account_id: s(fd, "to_account_id"),
      amount: n(fd, "amount"), transfer_date: s(fd, "date"), assignment_id: id, note: s(fd, "note"),
    }));
    refresh(id);
    return "Setoran sisa kas dicatat";
  });
}

export async function reviewLpj(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const approve = s(fd, "approve") === "1";
    ok(await supabase.rpc("review_lpj", { p_id: s(fd, "id"), p_approve: approve, p_note: s(fd, "note"), p_force: b(fd, "force") }));
    refresh(s(fd, "id"));
    return approve ? "Pertanggungjawaban disetujui" : "Pertanggungjawaban dikembalikan ke petugas";
  });
}

export async function grantException(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.rpc("grant_exception", { p_user: s(fd, "user_id"), p_reason: s(fd, "reason"), p_max: n(fd, "max_amount"), p_due: s(fd, "due_date") }));
    revalidatePath("/modal/pengecualian");
    return "Pengecualian diberikan";
  });
}

export async function reviewExpense(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("expenses").update({ status: s(fd, "status"), review_note: s(fd, "note") }).eq("id", s(fd, "id")));
    revalidatePath("/modal", "layout");
    revalidatePath("/kas/pengeluaran");
    return "Pengeluaran diperbarui";
  });
}
