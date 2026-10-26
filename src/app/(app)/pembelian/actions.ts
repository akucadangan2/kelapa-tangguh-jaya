"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, type ActionState } from "@/lib/action";

const refresh = (id?: string | null) => {
  revalidatePath("/pembelian");
  if (id) revalidatePath(`/pembelian/${id}`);
};

export async function verifyPurchase(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.rpc("verify_purchase", { p_id: s(fd, "id") }));
    refresh(s(fd, "id"));
    return "Pembelian diverifikasi";
  });
}

export async function correctPurchase(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const note = s(fd, "correction_note");
    if (!note) throw new Error("Alasan koreksi wajib diisi");
    ok(await supabase.from("purchases").update({
      price_per_kg: n(fd, "price_per_kg"),
      deduction_kg: n(fd, "deduction_kg") ?? 0,
      deduction_amount: n(fd, "deduction_amount") ?? 0,
      grade_id: s(fd, "grade_id"),
      condition: s(fd, "condition"),
      correction_note: note,
    }).eq("id", s(fd, "id")));
    refresh(s(fd, "id"));
    return "Koreksi tersimpan dan tercatat di jejak perubahan";
  });
}

export async function cancelPurchase(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const note = s(fd, "correction_note");
    if (!note) throw new Error("Alasan pembatalan wajib diisi");
    ok(await supabase.from("purchases").update({ status: "cancelled", correction_note: note }).eq("id", s(fd, "id")));
    refresh(s(fd, "id"));
    return "Pembelian dibatalkan";
  });
}

export async function addPurchasePayment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("purchase_payments").insert({
      purchase_id: s(fd, "id"), cash_account_id: s(fd, "cash_account_id"), amount: n(fd, "amount"),
      paid_at: s(fd, "paid_at"), note: s(fd, "note"),
    }));
    refresh(s(fd, "id"));
    return "Pembayaran dicatat";
  });
}

export async function allocateAdvance(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("advance_allocations").insert({ advance_id: s(fd, "advance_id"), purchase_id: s(fd, "id"), amount: n(fd, "amount") }));
    refresh(s(fd, "id"));
    return "Panjar dipotong";
  });
}

export async function receiveGoods(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("goods_receipts").insert({
      purchase_id: s(fd, "id"), warehouse_id: s(fd, "warehouse_id"), vehicle_id: s(fd, "vehicle_id"),
      driver_name: s(fd, "driver_name"), received_kg: n(fd, "received_kg"), sacks: n(fd, "sacks"),
      grade_id: s(fd, "grade_id"), condition: s(fd, "condition"), storage_location: s(fd, "storage_location"), note: s(fd, "note"),
    }));
    refresh(s(fd, "id"));
    revalidatePath("/gudang/stok");
    return "Barang diterima, lot dibuat";
  });
}

export async function giveAdvance(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("advances").insert({
      supplier_id: s(fd, "supplier_id"), cash_account_id: s(fd, "cash_account_id"), amount: n(fd, "amount"),
      given_at: s(fd, "given_at"), note: s(fd, "note"),
    }));
    revalidatePath("/pembelian/panjar");
    return "Panjar dicatat";
  });
}

export async function returnAdvance(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("advance_returns").insert({
      advance_id: s(fd, "advance_id"), cash_account_id: s(fd, "cash_account_id"), amount: n(fd, "amount"),
      returned_at: s(fd, "returned_at"), note: s(fd, "note"),
    }));
    revalidatePath("/pembelian/panjar");
    return "Pengembalian panjar dicatat";
  });
}
