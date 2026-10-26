import Link from "next/link";
import { Bell, BellOff, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sp } from "@/lib/options";
import { Card, Empty, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { QuickTabs } from "@/components/page-bits";
import { markNotificationsRead } from "../_actions/attachments";
import { tgl, today } from "@/lib/format";

export const metadata = { title: "Notifikasi" };

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default async function Notifikasi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole();
  const f = sp(await searchParams);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", s.id).order("created_at", { ascending: false }).limit(200);
  const all = data ?? [];
  const unread = all.filter((n: any) => !n.read_at).length;
  const rows = f.unread === "1" ? all.filter((n: any) => !n.read_at) : all;

  const t = today();
  const y = new Date(t + "T00:00:00Z");
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  const groups = new Map<string, any[]>();
  rows.forEach((n: any) => {
    const d = dayOf(n.created_at);
    groups.set(d, [...(groups.get(d) ?? []), n]);
  });
  const dayLabel = (d: string) => (d === t ? "Hari ini" : d === yesterday ? "Kemarin" : tgl(d));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifikasi" desc={unread ? `${unread} belum dibaca` : "Semua notifikasi sudah dibaca"}>
        {unread > 0 && <ActionForm action={markNotificationsRead} submit="Tandai semua dibaca" variant="ghost" inline><span /></ActionForm>}
      </PageHeader>

      <QuickTabs items={[
        { label: "Semua", href: "/notifikasi", active: f.unread !== "1" },
        { label: "Belum dibaca", href: "/notifikasi?unread=1", active: f.unread === "1", count: unread },
      ]} />

      {rows.length === 0 ? (
        <Empty icon={f.unread === "1" ? BellOff : Bell} title={f.unread === "1" ? "Tidak ada notifikasi yang belum dibaca" : "Belum ada notifikasi"} desc="Pengingat otomatis dan pemberitahuan persetujuan akan muncul di sini." />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([d, list]) => (
            <section key={d}>
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(d)}</div>
              <Card padded={false}>
                <ul className="divide-y divide-slate-100">
                  {list.map((n: any) => {
                    const body = (
                      <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-emerald-500"}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</div>
                          {n.body && <div className="mt-0.5 text-sm text-slate-500">{n.body}</div>}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{timeOf(n.created_at)}</span>
                        {n.link && <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300" />}
                      </div>
                    );
                    return (
                      <li key={n.id} className={n.read_at ? "" : "bg-emerald-50/40"}>
                        {n.link ? <Link href={n.link} className="block transition hover:bg-slate-50">{body}</Link> : body}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}