"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, type ActionState } from "@/lib/action";

function supplierPayload(fd: FormData) {
  return {
    name: s(fd, "name"),
    phone: s(fd, "phone"),
    address: s(fd, "address"),
    province_code: s(fd, "province_code"),
    regency_code: s(fd, "regency_code"),
    district_code: s(fd, "district_code"),
    village_code: s(fd, "village_code"),
    region_label: s(fd, "region_label"),
    lat: n(fd, "lat"),
    lng: n(fd, "lng"),
    directions: s(fd, "directions"),
    vehicle_access: s(fd, "vehicle_access"),
    product_codes: fd.getAll("product_codes").map(String),
    est_weight_kg: n(fd, "est_weight_kg"),
    est_sacks: n(fd, "est_sacks"),
    pickup_date: s(fd, "pickup_date"),
    offer_price: n(fd, "offer_price"),
    max_buy_price: n(fd, "max_buy_price"),
    pic_user_id: s(fd, "pic_user_id"),
    notes: s(fd, "notes"),
  };
}

export async function saveSupplier(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const id = s(fd, "id");
    const payload = supplierPayload(fd);
    if (!payload.name) throw new Error("Nama wajib diisi");
    if (id) ok(await supabase.from("suppliers").update(payload).eq("id", id));
    else ok(await supabase.from("suppliers").insert(payload));
    revalidatePath("/petani");
    return id ? "Data petani diperbarui" : "Petani ditambahkan";
  });
}