"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, uploadAttachments, type ActionState } from "@/lib/action";

const refresh = (id?: string | null) => {
  revalidatePath("/penjualan", "layout");
  if (id) revalidatePath(`/penjualan/${id}`);
};

export async function createOrder(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    let price = n(fd, "price_per_kg");
    const factoryId = s(fd, "factory_id");
    const productId = s(fd, "product_id");
    const { data: fp } = await supabase.from("v_factory_prices_current").select("id, price_per_kg, delivery_basis, price_status").eq("factory_id", factoryId).eq("product_id", productId).maybeSingle();
    if (!price && fp) price = Number(fp.price_per_kg);
    if (!price) throw new Error("Isi harga jual atau perbarui harga pabrik terlebih dahulu");
    const { data, error } = await supabase.from("sales_orders").insert({
      factory_id: factoryId, product_id: productId, price_per_kg: price, order_kg: n(fd, "order_kg"),
      order_date: s(fd, "order_date"), delivery_basis: fp?.delivery_basis, factory_price_id: fp?.id, note: s(fd, "note"),
    }).select("id").single();
    if (error) throw new Error(error.message);
    redirect(`/penjualan/${data.id}`);
  });
}

export async function allocateLot(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const lot = s(fd, "lot_id");
    const qty = n(fd, "qty_kg")!;
    const { data: l } = await supabase.from("v_lot_balance").select("free_kg, code").eq("id", lot).single();
    if (!l || qty > Number(l.free_kg) + 0.001) throw new Error(`Stok bebas lot ${l?.code} hanya ${l?.free_kg} kg`);
    ok(await supabase.from("sales_order_lots").insert({ sales_order_id: s(fd, "order_id"), lot_id: lot, qty_kg: qty }));
    refresh(s(fd, "order_id"));
    return "Lot dialokasikan untuk pesanan";
  });
}

export async function removeAllocation(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("sales_order_lots").delete().eq("id", s(fd, "id")));
    refresh(s(fd, "order_id"));
    return "Alokasi dihapus";
  });
}

export async function createDispatch(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const orderId = s(fd, "order_id");
    const lotIds = fd.getAll("lot_id").map(String);
    const qtys = fd.getAll("qty_kg").map(String);
    const lines = lotIds.map((lot, i) => ({ lot_id: lot, qty_kg: Number(qtys[i] || 0) })).filter((x) => x.qty_kg > 0);
    if (lines.length === 0) throw new Error("Isi berat keluar minimal satu lot");
    const { data: d, error } = await supabase.from("goods_dispatches").insert({
      sales_order_id: orderId, warehouse_id: s(fd, "warehouse_id"), vehicle_id: s(fd, "vehicle_id"), driver_name: s(fd, "driver_name"),
      delivery_note_no: s(fd, "delivery_note_no"), freight_cost: n(fd, "freight_cost") ?? 0, note: s(fd, "note"),
    }).select("id").single();
    if (error) throw new Error(error.message);
    const res = await supabase.from("dispatch_lots").insert(lines.map((x) => ({ ...x, dispatch_id: d.id })));
    if (res.error) {
      await supabase.from("goods_dispatches").delete().eq("id", d.id);
      throw new Error(res.error.message);
    }
    const files = fd.getAll("files") as File[];
    if (files.some((f) => f.size)) {
      const { data: { user } } = await supabase.auth.getUser();
      await uploadAttachments(supabase, user!.id, files, "dispatch", d.id, "load");
    }
    refresh(orderId);
    return "Barang keluar dicatat";
  });
}

export async function recordFactoryReceipt(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("factory_receipts").insert({
      dispatch_id: s(fd, "dispatch_id"), received_kg: n(fd, "received_kg"), quality_note: s(fd, "quality_note"),
      deduction_kg: n(fd, "deduction_kg") ?? 0, deduction_amount: n(fd, "deduction_amount") ?? 0,
      receiver_name: s(fd, "receiver_name"), received_at: s(fd, "received_at") ? new Date(s(fd, "received_at") + "T12:00:00+07:00").toISOString() : undefined, note: s(fd, "note"),
    }).select("id").single();
    if (error) throw new Error(error.message);
    const files = fd.getAll("files") as File[];
    if (files.some((f) => f.size)) {
      const { data: { user } } = await supabase.auth.getUser();
      await uploadAttachments(supabase, user!.id, files, "factory_receipt", data.id, "factory_receipt");
    }
    refresh(s(fd, "order_id"));
    return "Penerimaan pabrik dicatat";
  });
}

export async function recordReturn(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("sales_returns").insert({
      dispatch_id: s(fd, "dispatch_id"), lot_id: s(fd, "lot_id"), qty_kg: n(fd, "qty_kg"), action: s(fd, "action"), note: s(fd, "note"),
    }));
    refresh(s(fd, "order_id"));
    return "Retur dicatat";
  });
}

export async function createInvoice(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("invoices").insert({
      sales_order_id: s(fd, "order_id"), dispatch_id: s(fd, "dispatch_id"), invoice_date: s(fd, "invoice_date"), due_date: s(fd, "due_date"),
      accepted_kg: n(fd, "accepted_kg"), price_per_kg: n(fd, "price_per_kg"), deduction_amount: n(fd, "deduction_amount") ?? 0, note: s(fd, "note"),
    }));
    refresh(s(fd, "order_id"));
    return "Tagihan dibuat";
  });
}

export async function addInvoicePayment(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("invoice_payments").insert({
      invoice_id: s(fd, "invoice_id"), cash_account_id: s(fd, "cash_account_id"), amount: n(fd, "amount"), paid_at: s(fd, "paid_at"), note: s(fd, "note"),
    }));
    refresh(s(fd, "order_id"));
    return "Pembayaran dicatat";
  });
}

export async function cancelOrder(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    ok(await supabase.from("sales_orders").update({ status: "cancelled", note: s(fd, "note") }).eq("id", s(fd, "order_id")));
    refresh(s(fd, "order_id"));
    return "Pesanan dibatalkan";
  });
}
