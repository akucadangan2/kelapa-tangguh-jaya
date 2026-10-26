import { createClient } from "@/lib/supabase/server";

type Opt = { value: string; label: string };
const map = (rows: any[] | null, label: (r: any) => string): Opt[] => (rows ?? []).map((r) => ({ value: r.id, label: label(r) }));

/** Data pilihan yang sering dipakai di form & filter. */
export async function getOptions(keys: ("products" | "grades" | "warehouses" | "vehicles" | "categories" | "cash" | "allCash" | "officers" | "suppliers" | "factories" | "staff")[]) {
  const supabase = await createClient();
  const out: Record<string, Opt[]> & { raw: Record<string, any[]> } = { raw: {} } as any;
  await Promise.all(keys.map(async (k) => {
    let rows: any[] | null = null;
    switch (k) {
      case "products": rows = (await supabase.from("products").select("*").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "grades": rows = (await supabase.from("quality_grades").select("*, products(name)").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => `${r.products?.name} - ${r.name}`); break;
      case "warehouses": rows = (await supabase.from("warehouses").select("*").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "vehicles": rows = (await supabase.from("vehicles").select("*").eq("is_active", true).order("plate_no")).data; out[k] = map(rows, (r) => `${r.plate_no}${r.name ? " - " + r.name : ""}`); break;
      case "categories": rows = (await supabase.from("expense_categories").select("*").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "cash": rows = (await supabase.from("cash_accounts").select("*").eq("is_active", true).neq("type", "field").order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "allCash": rows = (await supabase.from("cash_accounts").select("*").eq("is_active", true).order("type").order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "officers": rows = (await supabase.from("user_roles").select("profiles(id, full_name)").eq("role", "field")).data;
        out[k] = (rows ?? []).map((r: any) => ({ value: r.profiles.id, label: r.profiles.full_name })); break;
      case "staff": rows = (await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")).data; out[k] = map(rows, (r) => r.full_name); break;
      case "suppliers": rows = (await supabase.from("suppliers").select("id, name, phone").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => r.name); break;
      case "factories": rows = (await supabase.from("factories").select("*").eq("is_active", true).order("name")).data; out[k] = map(rows, (r) => r.name); break;
    }
    out.raw[k] = rows ?? [];
  }));
  return out;
}

export function sp(searchParams: Record<string, string | string[] | undefined>) {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (v) o[k] = Array.isArray(v) ? v[0] : v;
  return o;
}
