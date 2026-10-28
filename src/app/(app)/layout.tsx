import { requireRole } from "@/lib/auth";
import { buildNav } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Tour } from "@/components/tour";
import { ROLE_LABEL } from "@/lib/format";
import { SITE } from "@/lib/site";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole();
  const supabase = await createClient();
  const office = session.isOffice;
  const wh = session.isWarehouse;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const head = { count: "exact" as const, head: true };
  const n = async (q: PromiseLike<{ count: number | null }>) => {
    try { return (await q).count ?? 0; } catch { return 0; }
  };
  const zero = Promise.resolve(0);

  const [
    unread, company, purchSubmitted, purchTransit, modal, opname, adjust, running, orders, overdue, expenses, expiredPrice,
  ] = await Promise.all([
    n(supabase.from("notifications").select("id", head).eq("user_id", session.id).is("read_at", null)),
    supabase.from("settings").select("value").eq("key", "company_name").maybeSingle(),
    office ? n(supabase.from("purchases").select("id", head).eq("status", "submitted")) : zero,
    office || wh ? n(supabase.from("purchases").select("id", head).eq("goods_status", "in_transit").neq("status", "cancelled")) : zero,
    office ? n(supabase.from("assignments").select("id", head).in("status", ["submitted", "approved", "lpj_submitted"])) : zero,
    office || wh ? n(supabase.from("stock_opnames").select("id", head).eq("status", "submitted")) : zero,
    office || wh ? n(supabase.from("stock_adjustments").select("id", head).eq("status", "submitted")) : zero,
    office || wh ? n(supabase.from("production_batches").select("id", head).eq("status", "running")) : zero,
    office || wh ? n(supabase.from("sales_orders").select("id", head).eq("status", "confirmed")) : zero,
    office ? n(supabase.from("invoices").select("id", head).in("status", ["unpaid", "partial"]).lt("due_date", today)) : zero,
    office ? n(supabase.from("expenses").select("id", head).eq("status", "submitted")) : zero,
    office || session.canSellPrice ? n(supabase.from("v_factory_prices_current").select("factory_id", head).eq("price_status", "expired")) : zero,
  ]);

  const badges: Record<string, number> = {
    "/notifikasi": unread,
    "/pembelian": office ? purchSubmitted : purchTransit,
    "/modal": modal,
    "/gudang/opname": opname,
    "/gudang/penyesuaian": adjust,
    "/produksi": running,
    "/penjualan": orders,
    "/penjualan/piutang": overdue,
    "/kas/pengeluaran": expenses,
    "/pabrik": expiredPrice,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        nav={buildNav(session)}
        name={session.name}
        roles={session.roles.map((r) => ROLE_LABEL[r]).join(", ")}
        unread={unread}
        badges={badges}
        company={(company.data?.value as string) || SITE.name}
      />
      <Tour userId={session.id} />
      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}