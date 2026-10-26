import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Input, Select } from "@/components/ui";

export type FilterDef =
  | { name: string; label: string; type: "date" | "text" }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[] };

/** Filter berbasis query string (GET) — hasilnya bisa dibagikan sebagai link. */
export function FilterBar({ filters, values }: { filters: FilterDef[]; values: Record<string, any> }) {
  const active = filters.some((f) => values[f.name]);
  return (
    <form className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/50 print:hidden">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        {filters.map((f) => (
          <label key={f.name} className={`text-xs text-slate-600 ${f.type === "text" ? "col-span-2 sm:min-w-56" : "sm:min-w-40"}`}>
            <span className="mb-1.5 block font-medium">{f.label}</span>
            {f.type === "select" ? (
              <Select name={f.name} defaultValue={values[f.name] ?? ""} options={f.options} placeholder="Semua" />
            ) : (
              <Input name={f.name} type={f.type} defaultValue={values[f.name] ?? ""} placeholder={f.type === "text" ? "Cari..." : undefined} />
            )}
          </label>
        ))}
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 sm:flex-none">
            <SlidersHorizontal size={16} /> Terapkan
          </button>
          {active && (
            <Link href="?" className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Reset
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}