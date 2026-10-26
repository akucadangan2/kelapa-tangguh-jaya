import Link from "next/link";
import {
  ArrowLeftRight, BarChart3, BookOpen, Boxes, ChevronRight, Coins, Factory, Flame, HandCoins, Image as ImageIcon,
  Landmark, Receipt, Scale, ShoppingCart, TrendingUp, Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { REPORTS } from "./reports";

export const metadata = { title: "Laporan" };

const META: Record<string, { group: string; icon: any; tone: string }> = {
  pembelian: { group: "ops", icon: ShoppingCart, tone: "bg-emerald-50 text-emerald-600" },
  penjualan: { group: "ops", icon: Factory, tone: "bg-sky-50 text-sky-600" },
  stok: { group: "ops", icon: Boxes, tone: "bg-amber-50 text-amber-600" },
  produksi: { group: "ops", icon: Flame, tone: "bg-orange-50 text-orange-600" },
  foto: { group: "ops", icon: ImageIcon, tone: "bg-slate-100 text-slate-600" },
  pengeluaran: { group: "fin", icon: Receipt, tone: "bg-rose-50 text-rose-600" },
  "kas-petugas": { group: "fin", icon: HandCoins, tone: "bg-violet-50 text-violet-600" },
  "panjar-utang-piutang": { group: "fin", icon: ArrowLeftRight, tone: "bg-amber-50 text-amber-600" },
  "kas-bank": { group: "fin", icon: Wallet, tone: "bg-sky-50 text-sky-600" },
  "laba-rugi": { group: "acc", icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600" },
  neraca: { group: "acc", icon: Scale, tone: "bg-slate-100 text-slate-600" },
  "arus-kas": { group: "acc", icon: Landmark, tone: "bg-sky-50 text-sky-600" },
  "laba-lot": { group: "acc", icon: Coins, tone: "bg-amber-50 text-amber-600" },
};

const GROUPS: [string, string, string][] = [
  ["ops", "Operasional", "Pembelian, penjualan, stok dan produksi"],
  ["fin", "Keuangan", "Pengeluaran, kas, panjar, utang dan piutang"],
  ["acc", "Akuntansi & laba", "Laba rugi, neraca, arus kas dan laba per lot"],
  ["other", "Lainnya", ""],
];

export default async function LaporanHub() {
  const s = await requireRole("owner", "finance", "warehouse");
  const list = REPORTS.filter((r) => r.allowed(s));
  const groupOf = (slug: string) => META[slug]?.group ?? "other";

  return (
    <div>
      <PageHeader title="Laporan" desc="Pilih laporan, tentukan periode harian, mingguan, bulanan atau rentang tanggal, lalu ekspor ke Excel/PDF" />

      <div className="space-y-8">
        {GROUPS.map(([key, title, desc]) => {
          const items = list.filter((r) => groupOf(r.slug) === key);
          if (items.length === 0) return null;
          return (
            <section key={key}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
                  {desc && <p className="text-xs text-slate-500">{desc}</p>}
                </div>
                <span className="text-xs text-slate-400">{items.length} laporan</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => {
                  const m = META[r.slug] ?? { icon: BarChart3, tone: "bg-slate-100 text-slate-600" };
                  const Icon = m.icon ?? BookOpen;
                  return (
                    <Link key={r.slug} href={r.href ?? `/laporan/${r.slug}`} className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:border-emerald-300 hover:shadow-md sm:p-5">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.tone}`}>
                        <Icon size={21} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 group-hover:text-emerald-700">{r.title}</div>
                        <div className="mt-0.5 text-sm leading-snug text-slate-500">{r.desc}</div>
                      </div>
                      <ChevronRight size={18} className="mt-0.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}