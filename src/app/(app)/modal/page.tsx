import { AlarmClock, HandCoins, Hourglass, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Badge, Card, PageHeader, Stat, Table } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { ExportButtons } from "@/components/export-buttons";
import { QuickTabs, Two } from "@/components/page-bits";
import { rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Modal petugas" };

const STATUSES = [
  ["submitted", "Menunggu persetujuan"], ["approved", "Menunggu pencairan"], ["disbursed", "Dicairkan"], ["active", "Berjalan"],
  ["lpj_submitted", "LPJ diperiksa"], ["lpj_returned", "LPJ dikembalikan"], ["closed", "Selesai"], ["rejected", "Ditolak"],
];
const RUNNING = ["disbursed", "active", "lpj_submitted", "lpj_returned"];

export default async function ModalPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole("owner", "finance");
  const f = sp(await searchParams);
  const supabase = await createClient();
  const opt = await getOptions(["officers"]);
  let q = supabase.from("assignments").select("*, profiles:user_id(full_name), accountabilities(remaining, cash_diff, status)")
    .order("created_at", { ascending: false }).limit(500);
  if (f.status) q = q.eq("status", f.status);
  else q = q.not("status", "in", "(closed,rejected,cancelled)");
  if (f.user) q = q.eq("user_id", f.user);
  const [{ data }, { data: open }] = await Promise.all([
    q,
    supabase.from("assignments").select("status, approved_amount, due_date").not("status", "in", "(closed,rejected,cancelled)"),
  ]);
  const rows = data ?? [];
  const all = open ?? [];
  const count = (s: string) => all.filter((r: any) => r.status === s).length;
  const t = today();
  const late = all.filter((r: any) => r.due_date && r.due_date < t && ["disbursed", "active", "lpj_returned"].includes(r.status)).length;
  const circulating = all.filter((r: any) => RUNNING.includes(r.status)).reduce((a: number, r: any) => a + Number(r.approved_amount ?? 0), 0);

  return (
    <div>
      <PageHeader title="Modal petugas lapangan" desc="Pengajuan, persetujuan, pencairan dan pertanggungjawaban modal">
        <ExportButtons filename="modal-petugas" rows={rows.map((r: any) => ({
          No: r.no, Tanggal: r.created_at?.slice(0, 10), Petugas: r.profiles?.full_name, Wilayah: r.region, Tujuan: r.purpose,
          Diajukan: r.requested_amount, "Saldo dibawa": r.carry_over_amount, Disetujui: r.approved_amount, Tenggat: r.due_date, Status: r.status,
        }))} />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Perlu disetujui" value={count("submitted")} icon={Hourglass} tone={count("submitted") ? "amber" : "default"} href="/modal?status=submitted" />
        <Stat label="Siap dicairkan" value={count("approved")} icon={HandCoins} tone={count("approved") ? "blue" : "default"} href="/modal?status=approved" />
        <Stat label="Modal beredar" value={rp(circulating)} hint={`${all.filter((r: any) => RUNNING.includes(r.status)).length} penugasan`} icon={Wallet} tone="green" />
        <Stat label="LPJ terlambat" value={late} icon={AlarmClock} tone={late ? "red" : "default"} />
      </div>

      <QuickTabs items={[
        { label: "Semua aktif", href: "/modal", active: !f.status },
        { label: "Perlu disetujui", href: "/modal?status=submitted", active: f.status === "submitted", count: count("submitted") },
        { label: "Siap dicairkan", href: "/modal?status=approved", active: f.status === "approved", count: count("approved") },
        { label: "Berjalan", href: "/modal?status=active", active: f.status === "active" },
        { label: "LPJ diperiksa", href: "/modal?status=lpj_submitted", active: f.status === "lpj_submitted", count: count("lpj_submitted") },
        { label: "LPJ dikembalikan", href: "/modal?status=lpj_returned", active: f.status === "lpj_returned" },
        { label: "Selesai", href: "/modal?status=closed", active: f.status === "closed" },
      ]} />

      <FilterBar values={f} filters={[
        { name: "status", label: "Status", type: "select", options: STATUSES.map(([value, label]) => ({ value, label })) },
        { name: "user", label: "Petugas", type: "select", options: opt.officers },
      ]} />

      <Card padded={false}>
        <Table rows={rows} href={(r: any) => `/modal/${r.id}`} empty="Tidak ada penugasan untuk filter ini" cols={[
          { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no ?? "Pengajuan baru"} sub={tgl(r.created_at)} /> },
          { key: "profiles", label: "Petugas / wilayah", render: (r: any) => <Two main={r.profiles?.full_name} sub={r.region} /> },
          { key: "requested_amount", label: "Diajukan", align: "right", render: (r: any) => <Two main={rp(r.requested_amount)} sub={Number(r.carry_over_amount) > 0 ? `saldo dibawa ${rp(r.carry_over_amount)}` : undefined} /> },
          { key: "approved_amount", label: "Disetujui", align: "right", render: (r: any) => (r.approved_amount ? <span className="font-semibold text-slate-900">{rp(r.approved_amount)}</span> : "-") },
          {
            key: "due_date",
            label: "Tenggat LPJ",
            render: (r: any) => {
              if (!r.due_date) return "-";
              const isLate = r.due_date < t && ["disbursed", "active", "lpj_returned"].includes(r.status);
              return <span className={isLate ? "font-semibold text-red-600" : ""}>{tgl(r.due_date)}{isLate ? " · terlambat" : ""}</span>;
            },
          },
          { key: "status", label: "Status", render: (r: any) => <div className="flex flex-col items-start gap-1"><Badge status={r.status} />{r.exception_id && <Badge tone="violet" label="Pengecualian" />}</div> },
        ]} />
      </Card>
    </div>
  );
}