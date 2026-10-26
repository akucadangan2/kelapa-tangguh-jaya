"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { run, ok, s, n, type ActionState } from "@/lib/action";

export async function saveFactory(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const payload = {
      name: s(fd, "name"), location: s(fd, "location"), contact_name: s(fd, "contact_name"), phone: s(fd, "phone"),
      product_codes: fd.getAll("product_codes").map(String), quality_spec: s(fd, "quality_spec"), notes: s(fd, "notes"),
      lat: n(fd, "lat"), lng: n(fd, "lng"),
    };
    const id = s(fd, "id");
    if (id) ok(await supabase.from("factories").update(payload).eq("id", id));
    else ok(await supabase.from("factories").insert(payload));
    revalidatePath("/pabrik");
    return "Data pabrik tersimpan";
  });
}

export async function addPrice(_: ActionState, fd: FormData) {
  return run(async () => {
    const supabase = await createClient();
    const hours = n(fd, "valid_hours");
    const validUntil = s(fd, "valid_until") ? new Date(s(fd, "valid_until") + "T23:59:59+07:00") : hours ? new Date(Date.now() + hours * 3600_000) : null;
    const { data, error } = await supabase.from("factory_prices").insert({
      factory_id: s(fd, "factory_id"), product_id: s(fd, "product_id"), price_per_kg: n(fd, "price_per_kg"),
      delivery_basis: s(fd, "delivery_basis"), freight_per_kg: n(fd, "freight_per_kg") ?? 0, deduction_pct: n(fd, "deduction_pct") ?? 0,
      deduction_note: s(fd, "deduction_note"), payment_term_days: n(fd, "payment_term_days") ?? 0, conditions: s(fd, "conditions"),
      confirmation: s(fd, "confirmation"), source: s(fd, "source"), valid_until: validUntil?.toISOString() ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const files = fd.getAll("files") as File[];
    if (files.some((f) => f.size)) {
      const { data: { user } } = await supabase.auth.getUser();
      const { uploadAttachments } = await import("@/lib/action");
      await uploadAttachments(supabase, user!.id, files, "factory_price", data.id, "other");
    }
    revalidatePath("/pabrik");
    return "Harga diperbarui";
  });
}
