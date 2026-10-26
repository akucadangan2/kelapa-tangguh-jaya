import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info as InfoIcon, Inbox, XCircle } from "lucide-react";
import { STATUS } from "@/lib/format";

/* ---------- Tata letak ---------- */

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:mb-2">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 print:hidden">{children}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", desc, padded = true }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; desc?: string; padded?: boolean }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const STAT_TONE = {
  default: { text: "text-slate-900", icon: "bg-slate-100 text-slate-600" },
  green: { text: "text-emerald-700", icon: "bg-emerald-50 text-emerald-600" },
  red: { text: "text-red-600", icon: "bg-red-50 text-red-600" },
  amber: { text: "text-amber-600", icon: "bg-amber-50 text-amber-600" },
  blue: { text: "text-sky-700", icon: "bg-sky-50 text-sky-600" },
  violet: { text: "text-violet-700", icon: "bg-violet-50 text-violet-600" },
};

export function Stat({
  label, value, hint, tone = "default", icon: Icon, href,
}: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: keyof typeof STAT_TONE; icon?: any; href?: string }) {
  const t = STAT_TONE[tone];
  const body = (
    <div className={`h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5 ${href ? "transition hover:border-emerald-300 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className={`mt-1.5 truncate text-lg font-bold tabular-nums sm:text-xl ${t.text}`}>{value}</div>
          {hint && <div className="mt-1 truncate text-xs text-slate-500">{hint}</div>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ---------- Label status ---------- */

const TONES = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
const DOTS = { gray: "bg-slate-400", blue: "bg-sky-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", violet: "bg-violet-500" };

export function Badge({ status, label, tone }: { status?: string; label?: string; tone?: keyof typeof TONES }) {
  const st = status ? STATUS[status] : undefined;
  const t = tone ?? st?.tone ?? "gray";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[t]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[t]}`} />
      {label ?? st?.label ?? status}
    </span>
  );
}

/* ---------- Tabel ---------- */

export type Col<T = any> = { key: string; label: string; align?: "right" | "center"; render?: (row: T) => React.ReactNode };

export function Table<T = any>({ cols, rows, empty = "Belum ada data", href, footer }: { cols: Col<T>[]; rows: T[]; empty?: string; href?: (row: T) => string; footer?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
            {cols.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold text-slate-500 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-10 text-center">
                <Inbox size={28} className="mx-auto mb-2 text-slate-300" />
                <span className="text-sm text-slate-400">{empty}</span>
              </td>
            </tr>
          )}
          {rows.map((r: any, i) => (
            <tr key={r.id ?? i} className="transition hover:bg-emerald-50/40">
              {cols.map((c, j) => {
                const v = c.render ? c.render(r) : r[c.key];
                return (
                  <td
                    key={c.key}
                    className={`px-4 py-3 align-top text-slate-700 ${c.align === "right" ? "whitespace-nowrap text-right tabular-nums" : c.align === "center" ? "text-center" : ""}`}
                  >
                    {href && j === 0 ? (
                      <Link href={href(r)} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                        {v ?? "-"}
                      </Link>
                    ) : (
                      v ?? "-"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold [&_td]:px-4 [&_td]:py-3">{footer}</tfoot>}
      </table>
    </div>
  );
}

/* ---------- Tombol & tautan ---------- */

const BTN = {
  primary: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
  ghost: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: keyof typeof BTN }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${BTN[variant]}`}>
      {children}
    </Link>
  );
}

/* ---------- Informasi ---------- */

export function Info({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-slate-800">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

const ALERT = {
  amber: { c: "border-amber-200 bg-amber-50 text-amber-900", i: AlertTriangle, ic: "text-amber-500" },
  red: { c: "border-red-200 bg-red-50 text-red-900", i: XCircle, ic: "text-red-500" },
  green: { c: "border-emerald-200 bg-emerald-50 text-emerald-900", i: CheckCircle2, ic: "text-emerald-500" },
  blue: { c: "border-sky-200 bg-sky-50 text-sky-900", i: InfoIcon, ic: "text-sky-500" },
};

export function Alert({ tone = "amber", children }: { tone?: keyof typeof ALERT; children: React.ReactNode }) {
  const a = ALERT[tone];
  const Icon = a.i;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${a.c}`}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${a.ic}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, desc, children }: { icon?: any; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={24} />
      </div>
      <div className="font-semibold text-slate-800">{title}</div>
      {desc && <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* ---------- Elemen form (tanpa state, bisa dipakai di server & client) ---------- */

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Field({ label, children, hint, className = "" }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "checkbox" || props.type === "radio") {
    return <input {...props} className={`h-4 w-4 rounded border-slate-300 text-emerald-600 accent-emerald-600 ${props.className ?? ""}`} />;
  }
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={`${inputCls} ${props.className ?? ""}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}