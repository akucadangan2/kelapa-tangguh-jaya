"use client";
import { FileSpreadsheet, Printer } from "lucide-react";

/** Ekspor Excel (SheetJS) dan PDF (dialog cetak browser → Simpan sebagai PDF). */
export function ExportButtons({ rows, filename, sheets }: { rows?: Record<string, any>[]; filename: string; sheets?: { name: string; rows: Record<string, any>[] }[] }) {
  async function toExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const list = sheets ?? [{ name: "Data", rows: rows ?? [] }];
    list.forEach((sh) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sh.rows), sh.name.slice(0, 31)));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
  const cls = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50";
  return (
    <div className="flex gap-2 print:hidden">
      <button onClick={toExcel} className={cls}>
        <FileSpreadsheet size={16} className="text-emerald-600" /> Excel
      </button>
      <button onClick={() => window.print()} className={cls}>
        <Printer size={16} className="text-slate-500" /> Cetak
      </button>
    </div>
  );
}