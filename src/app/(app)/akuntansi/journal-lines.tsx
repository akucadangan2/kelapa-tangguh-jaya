"use client";
import { useState } from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { rp } from "@/lib/format";

type Row = { id: number; d: string; c: string };

/** Baris jurnal manual yang bisa ditambah dan dihapus, dengan cek debit = kredit. */
export function JournalLines({ accounts }: { accounts: { value: string; label: string }[] }) {
  const [seq, setSeq] = useState(3);
  const [rows, setRows] = useState<Row[]>([{ id: 1, d: "", c: "" }, { id: 2, d: "", c: "" }]);
  const td = rows.reduce((a, r) => a + Number(r.d || 0), 0);
  const tc = rows.reduce((a, r) => a + Number(r.c || 0), 0);
  const balanced = td > 0 && Math.abs(td - tc) < 0.5;
  const cls = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:bg-slate-50 disabled:text-slate-400";
  const set = (id: number, patch: Partial<Row>) => setRows(rows.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-3 py-2.5">Akun</th>
              <th className="w-40 px-3 py-2.5">Debit</th>
              <th className="w-40 px-3 py-2.5">Kredit</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <select name="account" className={cls} defaultValue="">
                    <option value="">Pilih akun</option>
                    {accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input name="debit" type="number" step="any" min="0" className={cls} value={r.d} disabled={!!r.c} onChange={(e) => set(r.id, { d: e.target.value })} />
                  {!!r.c && <input type="hidden" name="debit" value="" />}
                </td>
                <td className="px-3 py-2">
                  <input name="credit" type="number" step="any" min="0" className={cls} value={r.c} disabled={!!r.d} onChange={(e) => set(r.id, { c: e.target.value })} />
                  {!!r.d && <input type="hidden" name="credit" value="" />}
                </td>
                <td className="pr-2 text-center">
                  <button type="button" disabled={rows.length <= 2} onClick={() => setRows(rows.filter((x) => x.id !== r.id))} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400" aria-label="Hapus baris">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
              <td className="px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 tabular-nums">{rp(td)}</td>
              <td className="px-3 py-2.5 tabular-nums">{rp(tc)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { setRows([...rows, { id: seq, d: "", c: "" }]); setSeq(seq + 1); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          <Plus size={16} />Tambah baris
        </button>
        {td === 0 && tc === 0 ? (
          <span className="text-sm text-slate-400">Isi minimal dua baris</span>
        ) : balanced ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} />Debit dan kredit seimbang</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600"><XCircle size={16} />Selisih {rp(Math.abs(td - tc))}</span>
        )}
      </div>
    </div>
  );
}