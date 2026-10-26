import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "finance" | "field" | "warehouse";

export type Session = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  isOwner: boolean;
  isOffice: boolean;
  isWarehouse: boolean;
  canSellPrice: boolean;
  canSalary: boolean;
  canProfit: boolean;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const r = (roles ?? []).map((x: any) => x.role as Role);
  const isOwner = r.includes("owner");
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || user.email || "",
    roles: r,
    isOwner,
    isOffice: isOwner || r.includes("finance"),
    isWarehouse: r.includes("warehouse"),
    canSellPrice: isOwner || !!profile?.can_view_sell_price,
    canSalary: isOwner || !!profile?.can_view_salary,
    canProfit: isOwner || !!profile?.can_view_profit,
  };
});

/** Pastikan pengguna login dan memiliki salah satu peran. */
export async function requireRole(...allowed: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.roles.length === 0) redirect("/login?e=norole");
  if (allowed.length && !allowed.some((r) => s.roles.includes(r))) redirect("/dashboard?e=akses");
  return s;
}
