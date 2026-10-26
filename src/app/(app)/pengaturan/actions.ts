"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { run, ok, s, n, b, type ActionState } from "@/lib/action";

async function ownerOnly() {
  const ses = await getSession();
  if (!ses?.isOwner) throw new Error("Hanya pemilik/admin");
  return ses;
}

export async function createUser(_: ActionState, fd: FormData) {
  return run(async () => {
    await ownerOnly();
    const admin = createAdminClient();
    const email = s(fd, "email")!;
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) throw new Error("Password minimal 8 karakter");
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: s(fd, "full_name"), phone: s(fd, "phone") },
    });
    if (error) throw new Error(error.message);
    const id = data.user.id;
    ok(await admin.from("profiles").upsert({
      id, full_name: s(fd, "full_name") ?? email, phone: s(fd, "phone"),
      can_view_sell_price: b(fd, "can_view_sell_price"), can_view_salary: b(fd, "can_view_salary"), can_view_profit: b(fd, "can_view_profit"),
    }));
    const roles = fd.getAll("roles").map(String);
    if (roles.length) ok(await admin.from("user_roles").insert(roles.map((role) => ({ user_id: id, role }))));
    revalidatePath("/pengaturan/pengguna");
    return `Akun ${email} dibuat`;
  });
}

export async function updateUser(_: ActionState, fd: FormData) {
  return run(async () => {
    await ownerOnly();
    const supabase = await createClient();
    const id = s(fd, "id")!;
    ok(await supabase.from("profiles").update({
      full_name: s(fd, "full_name"), phone: s(fd, "phone"), is_active: b(fd, "is_active"),
      can_view_sell_price: b(fd, "can_view_sell_price"), can_view_salary: b(fd, "can_view_salary"), can_view_profit: b(fd, "can_view_profit"),
    }).eq("id", id));
    const roles = fd.getAll("roles").map(String);
    const { data: cur } = await supabase.from("user_roles").select("role").eq("user_id", id);
    const current = (cur ?? []).map((r: any) => r.role);
    const del = current.filter((r) => !roles.includes(r));
    const add = roles.filter((r) => !current.includes(r));
    if (del.length) ok(await supabase.from("user_roles").delete().eq("user_id", id).in("role", del));
    if (add.length) ok(await supabase.from("user_roles").insert(add.map((role) => ({ user_id: id, role }))));
    const pw = String(fd.get("password") ?? "");
    if (pw) {
      if (pw.length < 8) throw new Error("Password minimal 8 karakter");
      const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: pw });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/pengaturan/pengguna");
    return "Pengguna diperbarui";
  });
}

const MASTER_TABLES = ["products", "quality_grades", "warehouses", "vehicles", "expense_categories"] as const;

export async function saveMaster(_: ActionState, fd: FormData) {
  return run(async () => {
    await ownerOnly();
    const supabase = await createClient();
    const table = s(fd, "table") as (typeof MASTER_TABLES)[number];
    if (!MASTER_TABLES.includes(table)) throw new Error("Tabel tidak dikenal");
    const id = s(fd, "id");
    const payload: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (["table", "id"].includes(k) || k.startsWith("$")) continue;
      payload[k] = String(v).trim() === "" ? null : k.endsWith("_kg") ? Number(v) : String(v);
    }
    if ("is_active" in payload || id) payload.is_active = fd.get("is_active") === "on" || !id;
    if (id) ok(await supabase.from(table).update(payload).eq("id", id));
    else ok(await supabase.from(table).insert(payload));
    revalidatePath("/pengaturan/master");
    return "Tersimpan";
  });
}

export async function saveSettings(_: ActionState, fd: FormData) {
  return run(async () => {
    await ownerOnly();
    const supabase = await createClient();
    const rows = [
      { key: "company_name", value: s(fd, "company_name") ?? "" },
      { key: "weight_tolerance_pct", value: n(fd, "weight_tolerance_pct") ?? 2 },
      { key: "transit_days", value: n(fd, "transit_days") ?? 3 },
      { key: "advance_open_days", value: n(fd, "advance_open_days") ?? 30 },
      { key: "lpj_default_days", value: n(fd, "lpj_default_days") ?? 7 },
      { key: "price_valid_hours", value: n(fd, "price_valid_hours") ?? 24 },
      { key: "allow_gallery_upload", value: b(fd, "allow_gallery_upload") },
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    ok(await supabase.from("settings").upsert(rows));
    revalidatePath("/", "layout");
    return "Aturan tersimpan";
  });
}

export async function runReminders(_: ActionState, _fd: FormData) {
  return run(async () => {
    await ownerOnly();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("generate_reminders");
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return `${data} pengingat diperiksa`;
  });
}
