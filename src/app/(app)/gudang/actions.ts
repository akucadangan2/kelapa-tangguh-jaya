"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, type ActionState } from "@/lib/action";

export async function setOpnameStatus(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const status = s(fd, "status");
    ok(await supabase.from("stock_opnames").update({ status, approved_by: user!.id, approved_at: new Date().toISOString() }).eq("id", s(fd, "id")));
    revalidatePath("/gudang", "layout");
    return status === "approved" ? "Stok opname disetujui, saldo disesuaikan" : "Stok opname ditolak";
  });
}

export async function createOpname(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const lotIds = fd.getAll("lot_id").map(String);
    const counted = fd.getAll("counted_kg").map(String);
    const reasons = fd.getAll("reason").map(String);
    const system = fd.getAll("system_kg").map(String);
    const { data: op, error } = await supabase.from("stock_opnames").insert({ warehouse_id: s(fd, "warehouse_id"), opname_date: s(fd, "opname_date"), note: s(fd, "note") }).select().single();
    if (error) throw new Error(error.message);
    const items = lotIds.map((lot, i) => ({ opname_id: op.id, lot_id: lot, system_kg: Number(system[i]), counted_kg: counted[i] === "" ? Number(system[i]) : Number(counted[i]), reason: reasons[i] || null }));
    ok(await supabase.from("stock_opname_items").insert(items));
    revalidatePath("/gudang/opname");
    return `Stok opname ${op.no} dikirim untuk disetujui`;
  });
}

export async function createAdjustment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("stock_adjustments").insert({
      lot_id: s(fd, "lot_id"), type: s(fd, "type"), qty_kg: n(fd, "qty_kg"), to_warehouse_id: s(fd, "to_warehouse_id"), reason: s(fd, "reason"),
    }));
    revalidatePath("/gudang/penyesuaian");
    return "Penyesuaian diajukan";
  });
}

export async function setAdjustmentStatus(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    ok(await supabase.from("stock_adjustments").update({ status: s(fd, "status"), approved_by: user!.id, approved_at: new Date().toISOString() }).eq("id", s(fd, "id")));
    revalidatePath("/gudang", "layout");
    return "Status penyesuaian diperbarui";
  });
}
