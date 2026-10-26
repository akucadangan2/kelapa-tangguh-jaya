import Link from "next/link";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";

/** Tab cepat berbasis tautan (filter yang sering dipakai). */
export function QuickTabs({ items }: { items: { label: string; href: string; active?: boolean; count?: number }[] }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden">
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm sm:min-w-0">
        {items.map((t) => (
          <Link
            key={`${t.label}|${t.href}`}
            href={t.href}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${t.active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${t.active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>{t.count}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Tautan kembali kecil di atas judul halaman detail. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-700 print:hidden">
      <ArrowLeft size={16} /> {label}
    </Link>
  );
}

/** Kartu yang bisa dibuka-tutup (untuk aksi yang jarang dipakai). */
export function Collapse({ title, desc, children, open, tone = "default" }: { title: string; desc?: string; children: React.ReactNode; open?: boolean; tone?: "default" | "danger" }) {
  return (
    <details open={open} className={`group rounded-2xl border bg-white shadow-sm shadow-slate-200/50 ${tone === "danger" ? "border-red-200" : "border-slate-200/80"} print:hidden`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <div className={`text-[15px] font-semibold ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}>{title}</div>
          {desc && <div className="mt-0.5 text-xs text-slate-500">{desc}</div>}
        </div>
        <ChevronDown size={18} className="shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 p-5">{children}</div>
    </details>
  );
}

/** Tahapan proses (misalnya Dicatat → Diverifikasi → Diterima gudang). */
export function Steps({ steps }: { steps: { label: string; done: boolean; sub?: string; warn?: boolean }[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full ${s.done || isCurrent ? "bg-emerald-500" : "bg-slate-200"}`} />}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white ${
                s.warn ? "bg-red-500 text-white" : s.done ? "bg-emerald-600 text-white" : isCurrent ? "border-2 border-emerald-500 bg-white text-emerald-700" : "border-2 border-slate-200 bg-white text-slate-400"
              }`}
            >
              {s.done && !s.warn ? <Check size={16} /> : i + 1}
            </span>
            <span className={`mt-2 text-xs font-semibold ${s.done || isCurrent ? "text-slate-800" : "text-slate-400"}`}>{s.label}</span>
            {s.sub && <span className="mt-0.5 text-[11px] text-slate-500">{s.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Dua baris dalam satu sel tabel: teks utama + keterangan kecil. */
export function Two({ main, sub }: { main: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-slate-800">{main}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}