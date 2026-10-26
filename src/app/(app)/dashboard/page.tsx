import Link from "next/link";
import {
  ArrowRight, Banknote, Bell, ClipboardCheck, Coins, Factory, FileCheck2, HandCoins, Package, Receipt, Scale, ShoppingCart, Smartphone, TrendingUp, Truck, Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, Empty, Stat, Table } from "@/components/ui";
import { jam, kg, monthStart, rp, tgl, today } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const PRODUCT_COLOR: Record<string, string> = { Kopra: "bg-amber-500", Tempurung: "bg-orange-700", Arang: "bg-slate-800" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const s = await requireRole();
  const { e } = await searchParams;
  const supabase = await createClient();
  const from = monthStart();
  const to = today();
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Makassar" }));
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  if (!s.isOffice && !s.isWarehouse) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greet}, {s.name}</h1>
        </div>
        <Empty icon={Smartphone} title="Gunakan aplikasi Android" desc="Akun petugas lapangan memakai aplikasi Android untuk mencatat kunjungan, pembelian, panjar, pengeluaran dan pertanggungjawaban.">
          <Link href="/unduh" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Unduh aplikasi <ArrowRight size={16} />
          </Link>
        </Empty>
      </div>
    );
  }

  const [cash, stock, officers, purch, sales, exp, pending, notif, transit, journal] = await Promise.all([
    s.isOffice ? supabase.from("v_cash_balance").select("type, balance").eq("is_active", true) : { data: [] },
    supabase.from("v_stock_summary").select("*"),
    s.isOffice ? supabase.from("v_field_officers").select("*").order("full_name") : { data: [] },
    supabase.from("purchases").select("agreed_kg, total_amount").neq("status", "cancelled").gte("purchase_date", from).lte("purchase_date", to),
    s.isOffice ? supabase.from("invoices").select("accepted_kg, total_amount").neq("status", "cancelled").gte("invoice_date", from).lte("invoice_date", to) : { data: [] },
    s.isOffice ? supabase.from("expenses").select("amount").neq("status", "cancelled").gte("expense_date", from).lte("expense_date", to) : { data: [] },
    Promise.all([
      supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "lpj_submitted"),
      supabase.from("stock_opnames").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("stock_adjustments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("purchases").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    ]),
    supabase.from("notifications").select("*").eq("user_id", s.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("v_purchases_in_transit").select("*").order("purchase_date").limit(8),
    s.isOffice && s.canProfit
      ? supabase.from("journal_lines").select("debit, credit, coa_accounts!inner(type), journal_entries!inner(entry_date)")
          .gte("journal_entries.entry_date", from).lte("journal_entries.entry_date", to).in("coa_accounts.type", ["revenue", "cogs", "expense", "other_income"])
      : { data: [] },
  ]);

  const sum = (rows: any[] | null, k: string) => (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const cashBiz = (cash.data ?? []).filter((c: any) => c.type !== "field");
  const cashField = (cash.data ?? []).filter((c: any) => c.type === "field");
  const byProduct = new Map<string, { kg: number; value: number }>();
  (stock.data ?? []).forEach((r: any) => {
    const x = byProduct.get(r.product_name) ?? { kg: 0, value: 0 };
    x.kg += Number(r.balance_kg);
    x.value += Number(r.stock_value);
    byProduct.set(r.product_name, x);
  });
  const stockTotal = [...byProduct.values()].reduce((a, v) => a + v.kg, 0);
  let profit = 0;
  (journal.data ?? []).forEach((l: any) => {
    const t = l.coa_accounts.type;
    profit += t === "revenue" || t === "other_income" ? Number(l.credit) - Number(l.debit) : -(Number(l.debit) - Number(l.credit));
  });
  const [pSub, pApp, pLpj, pOpn, pAdj, pExp, pPur] = (pending as any[]).map((r) => r.count ?? 0);

  const tasks = [
    { n: pSub, label: "Pengajuan modal", sub: "Perlu disetujui", href: "/modal?status=submitted", icon: HandCoins },
    { n: pApp, label: "Modal siap dicairkan", sub: "Sudah disetujui", href: "/modal?status=approved", icon: Wallet },
    { n: pLpj, label: "Pertanggungjawaban", sub: "Perlu diperiksa", href: "/modal?status=lpj_submitted", icon: FileCheck2 },
    { n: pPur, label: "Pembelian", sub: "Belum diverifikasi", href: "/pembelian?status=submitted", icon: ShoppingCart },
    { n: pExp, label: "Pengeluaran", sub: "Belum diperiksa", href: "/kas/pengeluaran?status=submitted", icon: Receipt },
    { n: pOpn, label: "Stok opname", sub: "Menunggu persetujuan", href: "/gudang/opname", icon: ClipboardCheck },
    { n: pAdj, label: "Penyesuaian stok", sub: "Menunggu persetujuan", href: "/gudang/penyesuaian", icon: Scale },
  ];
  const openTasks = tasks.filter((t) => t.n > 0);
  const officerRows = (officers.data ?? []) as any[];
  const activeOfficers = officerRows.filter((r) => r.assignment_no);

  return (
    <div className="space-y-6">
      {/* Sapaan */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">{greet}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{s.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Ringkasan {tgl(from)} – {tgl(to)}</p>
        </div>
        {s.isOffice && (
          <div className="flex flex-wrap gap-2">
            <Link href="/penjualan" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <Truck size={16} /> Penjualan
            </Link>
            <Link href="/laporan" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              <TrendingUp size={16} /> Laporan
            </Link>
          </div>
        )}
      </div>

      {e === "akses" && <Alert tone="red">Anda tidak memiliki akses ke halaman tersebut.</Alert>}

      {/* Angka utama */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {s.isOffice && <Stat label="Kas usaha & bank" value={rp(sum(cashBiz, "balance"))} icon={Banknote} tone="green" href="/kas" />}
        {s.isOffice && <Stat label="Kas di petugas" value={rp(sum(cashField, "balance"))} hint={`${activeOfficers.length} petugas bertugas`} icon={Wallet} tone="violet" href="/modal" />}
        <Stat
          label="Pembelian bulan ini"
          value={s.isOffice ? rp(sum(purch.data, "total_amount")) : kg(sum(purch.data, "agreed_kg"))}
          hint={s.isOffice ? kg(sum(purch.data, "agreed_kg")) : `${(purch.data ?? []).length} transaksi`}
          icon={ShoppingCart}
          tone="amber"
          href="/pembelian"
        />
        {s.isOffice && <Stat label="Penjualan bulan ini" value={rp(sum(sales.data, "total_amount"))} hint={kg(sum(sales.data, "accepted_kg"))} icon={Factory} tone="blue" href="/penjualan" />}
        {s.isOffice && <Stat label="Biaya operasional" value={rp(sum(exp.data, "amount"))} hint="Bulan ini" icon={Receipt} href="/kas/pengeluaran" />}
        {s.isOffice && s.canProfit && <Stat label="Laba bersih bulan ini" value={rp(profit)} tone={profit < 0 ? "red" : "green"} icon={Coins} href="/laporan" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stok */}
        <Card title="Stok gudang" desc={`Total ${kg(stockTotal)}`} actions={<Link href="/gudang/stok" className="text-sm font-semibold text-emerald-700 hover:underline">Rincian</Link>}>
          {byProduct.size === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Belum ada stok</p>
          ) : (
            <div className="space-y-4">
              {[...byProduct.entries()].map(([name, v]) => {
                const pct = stockTotal > 0 ? Math.round((v.kg / stockTotal) * 100) : 0;
                return (
                  <div key={name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <span className={`h-2.5 w-2.5 rounded-full ${PRODUCT_COLOR[name] ?? "bg-emerald-500"}`} />
                        {name}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900">{kg(v.kg)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${PRODUCT_COLOR[name] ?? "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                    {s.isOffice && <div className="mt-1 text-xs text-slate-500">Nilai {rp(v.value)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Menunggu tindakan */}
        <Card
          className="lg:col-span-2"
          title="Perlu tindakan"
          desc={s.isOffice ? (openTasks.length ? `${openTasks.reduce((a, t) => a + t.n, 0)} item menunggu` : "Semua sudah ditangani") : "Barang yang menuju gudang"}
        >
          {s.isOffice ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {tasks.map((t) => {
                const Icon = t.icon;
                const hot = t.n > 0;
                return (
                  <Link
                    key={t.label}
                    href={t.href}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition ${hot ? "border-amber-200 bg-amber-50/60 hover:border-amber-300" : "border-slate-100 hover:bg-slate-50"}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${hot ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${hot ? "text-slate-900" : "text-slate-500"}`}>{t.label}</div>
                      <div className="text-xs text-slate-500">{t.sub}</div>
                    </div>
                    <span className={`min-w-8 rounded-lg px-2 py-1 text-center text-sm font-bold tabular-nums ${hot ? "bg-amber-500 text-white" : "text-slate-300"}`}>{t.n}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <TransitList rows={transit.data ?? []} />
          )}
        </Card>
      </div>

      {s.isOffice && (
        <Card title="Petugas lapangan" desc={`${activeOfficers.length} dari ${officerRows.length} petugas sedang memegang modal`} actions={<Link href="/modal" className="text-sm font-semibold text-emerald-700 hover:underline">Semua penugasan</Link>}>
          <Table
            rows={officerRows}
            href={(r: any) => (r.assignment_id ? `/modal/${r.assignment_id}` : "/modal")}
            empty="Belum ada petugas lapangan"
            cols={[
              { key: "full_name", label: "Petugas" },
              { key: "assignment_no", label: "Penugasan", render: (r: any) => (r.assignment_no ? <div className="flex flex-col gap-1"><span>{r.assignment_no}</span><Badge status={r.assignment_status} /></div> : <span className="text-slate-400">Tidak bertugas</span>) },
              { key: "received", label: "Modal diterima", align: "right", render: (r: any) => rp(r.received) },
              { key: "cash_balance", label: "Sisa kas", align: "right", render: (r: any) => <span className="font-semibold text-slate-900">{rp(r.cash_balance)}</span> },
              { key: "open_advance_amount", label: "Panjar terbuka", align: "right", render: (r: any) => (Number(r.open_advances) > 0 ? <span>{rp(r.open_advance_amount)} <span className="text-xs text-slate-400">({r.open_advances})</span></span> : "-") },
              { key: "in_transit", label: "Barang di jalan", align: "right", render: (r: any) => (Number(r.in_transit) > 0 ? r.in_transit : "-") },
              { key: "cash_diff", label: "Selisih", align: "right", render: (r: any) => (r.cash_diff ? <span className="font-semibold text-red-600">{rp(r.cash_diff)}</span> : "-") },
              {
                key: "due_date",
                label: "Tenggat LPJ",
                render: (r: any) => {
                  const late = r.due_date && r.due_date < to && ["active", "disbursed"].includes(r.assignment_status);
                  return r.due_date ? <span className={late ? "font-semibold text-red-600" : ""}>{tgl(r.due_date)}{late ? " · terlambat" : ""}</span> : "-";
                },
              },
            ]}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {s.isOffice && (
          <Card title="Barang menuju gudang" desc="Pembelian yang belum diterima gudang" actions={<Link href="/pembelian" className="text-sm font-semibold text-emerald-700 hover:underline">Pembelian</Link>}>
            <TransitList rows={transit.data ?? []} />
          </Card>
        )}
        <Card title="Notifikasi terbaru" actions={<Link href="/notifikasi" className="text-sm font-semibold text-emerald-700 hover:underline">Semua</Link>} className={s.isOffice ? "" : "lg:col-span-2"}>
          {(notif.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Tidak ada notifikasi</p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-100">
              {(notif.data ?? []).map((n: any) => {
                const inner = (
                  <div className="flex gap-3 py-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.read_at ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"}`}>
                      <Bell size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm ${n.read_at ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</span>
                        <span className="whitespace-nowrap text-xs text-slate-400">{jam(n.created_at)}</span>
                      </div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{n.body}</p>}
                    </div>
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link href={n.link} className="block rounded-lg hover:bg-slate-50">{inner}</Link> : inner}</li>;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function TransitList({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-slate-400">Tidak ada barang dalam perjalanan</p>;
  const now = Date.now();
  return (
    <ul className="-my-2 divide-y divide-slate-100">
      {rows.map((r) => {
        const days = Math.floor((now - new Date(r.purchase_date).getTime()) / 86400000);
        return (
          <li key={r.id}>
            <Link href={`/pembelian/${r.id}`} className="flex items-center gap-3 rounded-lg py-3 hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Package size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">{r.supplier_name} · {r.product_name}</div>
                <div className="text-xs text-slate-500">{r.no} · {tgl(r.purchase_date)}{r.officer_name ? ` · ${r.officer_name}` : ""}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-slate-900">{kg(r.net_kg)}</div>
                <div className={`text-xs font-medium ${days > 2 ? "text-red-600" : "text-slate-400"}`}>{days <= 0 ? "Hari ini" : `${days} hari`}</div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}