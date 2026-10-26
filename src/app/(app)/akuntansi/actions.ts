"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, type ActionState } from "@/lib/action";

export async function createManualJournal(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const accs = fd.getAll("account").map(String);
    const debits = fd.getAll("debit").map((v) => Number(v || 0));
    const credits = fd.getAll("credit").map((v) => Number(v || 0));
    const lines = accs.map((a, i) => ({ a, d: debits[i], c: credits[i] })).filter((l) => l.a && (l.d || l.c));
    if (lines.length < 2) throw new Error("Minimal dua baris jurnal");
    ok(await supabase.rpc("create_manual_journal", { p_date: s(fd, "date"), p_desc: s(fd, "description"), p_lines: lines }));
    revalidatePath("/akuntansi", "layout");
    return "Jurnal manual tersimpan";
  });
}

export async function deleteManualJournal(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("journal_entries").delete().eq("id", s(fd, "id")).eq("is_manual", true));
    revalidatePath("/akuntansi", "layout");
    return "Jurnal dihapus";
  });
}

export async function setPeriod(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.rpc("close_period", { p_period: s(fd, "period"), p_close: s(fd, "close") === "1" }));
    revalidatePath("/akuntansi/periode");
    return "Periode diperbarui";
  });
}
