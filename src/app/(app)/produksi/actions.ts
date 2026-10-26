"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, type ActionState } from "@/lib/action";

export async function createBatch(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("production_batches").insert({
      batch_date: s(fd, "batch_date"), kiln: s(fd, "kiln"), warehouse_id: s(fd, "warehouse_id"),
      operator_name: s(fd, "operator_name"), weight_basis: s(fd, "weight_basis") ?? "dry", note: s(fd, "note"),
    }).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/produksi/${data.id}`);
  });
}

export async function addInput(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("production_inputs").insert({ batch_id: s(fd, "batch_id"), lot_id: s(fd, "lot_id"), qty_kg: n(fd, "qty_kg") }));
    revalidatePath(`/produksi/${s(fd, "batch_id")}`);
    return "Bahan baku ditambahkan";
  });
}

export async function removeInput(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("production_inputs").delete().eq("id", s(fd, "id")));
    revalidatePath(`/produksi/${s(fd, "batch_id")}`);
    return "Dihapus";
  });
}

export async function addCost(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("production_costs").insert({
      batch_id: s(fd, "batch_id"), type: s(fd, "type"), amount: n(fd, "amount"), cash_account_id: s(fd, "cash_account_id"),
      note: s(fd, "note"), cost_date: s(fd, "cost_date"),
    }));
    revalidatePath(`/produksi/${s(fd, "batch_id")}`);
    return "Biaya ditambahkan";
  });
}

export async function finishBatch(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("production_batches").update({
      status: "done", output_good_kg: n(fd, "output_good_kg"), output_rework_kg: n(fd, "output_rework_kg") ?? 0,
      loss_kg: n(fd, "loss_kg") ?? 0, grade_id: s(fd, "grade_id"),
    }).eq("id", s(fd, "batch_id")));
    revalidatePath(`/produksi/${s(fd, "batch_id")}`);
    revalidatePath("/produksi");
    return "Batch selesai, stok arang bertambah";
  });
}
