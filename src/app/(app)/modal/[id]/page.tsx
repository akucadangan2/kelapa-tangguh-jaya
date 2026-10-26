import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownLeft, MessageCircle, PiggyBank, Receipt, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Info, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { ExportButtons } from "@/components/export-buttons";
import { BackLink, Collapse, QuickTabs, Steps, Two } from "@/components/page-bits";
import { jam, kg, rp, tgl, today } from "@/lib/format";
import { approveAssignment, disburseAssignment, recordReturn, rejectAssignment, reviewExpense, reviewLpj } from "../actions";

export const metadata = { title: "Detail penugasan" };

const ORDER = ["submitted", "approved", "disbursed", "active", "lpj_submitted", "closed"];

export default async function AssignmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const session = await requireRole("owner", "finance");
  const { id } = await params;
  const { tab = "beli" } = await searchParams;
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("*, profiles:user_id(full_name, phone), approver:approved_by(full_name), assignment_exceptions:exception_id(reason, max_amount)").eq("id", id).single();
  if (!a) notFound();

  const [items, costs, summary, transfers, purchases, advances, expenses, lpj, missing, fieldAcc, opt] = await Promise.all([
    supabase.from("assignment_items").select("*, products(name)").eq("assignment_id", id),
    supabase.from("assignment_costs").select("*, expense_categories(name)").eq("assignment_id", id),
    supabase.rpc("assignment_summary", { p_id: id }),
    supabase.from("cash_transfers").select("*, from:from_account_id(name), to:to_account_id(name)").eq("assignment_id", id).order("transfer_date"),
    supabase.from("purchases").select("*, suppliers(name), products(name)").eq("assignment_id", id).order("purchase_date"),
    supabase.from("advances").select("*, suppliers(name)").eq("assignment_id", id).order("given_at"),
    supabase.from("expenses").select("*, expense_categories(name)").eq("assignment_id", id).order("expense_date"),
    supabase.from("accountabilities").select("*, reviewer:reviewed_by(full_name)").eq("assignment_id", id).maybeSingle(),
    supabase.rpc("assignment_missing_proofs", { p_id: id }),
    supabase.from("v_cash_balance").select("id, balance").eq("type", "field").eq("owner_id", a.user_id).maybeSingle(),
    getOptions(["cash"]),
  ]);
  const sm: any = summary.data ?? {};
  const l: any = lpj.data;
  const miss = missing.data ?? [];
  const toDisburse = Math.max(Number(a.approved_amount ?? a.requested_amount) - Number(a.carry_over_amount), 0);
  const plannedCost = (costs.data ?? []).reduce((x: number, c: any) => x + Number(c.amount), 0);
  const st = a.status as string;
  const idx = st === "lpj_returned" ? 4 : ORDER.indexOf(st);
  const rejected = st === "rejected" || st === "cancelled";
  const phone = String(a.profiles?.phone ?? "").replace(/\D/g, "");
  const wa = phone.startsWith("0") ? `62${phone.slice(1)}` : phone;
  const received = Number(sm.received ?? 0);
  const usedPct = received > 0 ? Math.min(100, Math.round((Number(sm.used ?? 0) / received) * 100)) : 0;
  const late = a.due_date && a.due_date < today() && ["disbursed", "active", "lpj_returned"].includes(st);
  const pendingExp = (expenses.data ?? []).filter((e: any) => e.status === "submitted").length;

  const lpjRows = [
    { u: "Saldo dibawa dari penugasan sebelumnya", v: sm.carry_over },
    { u: "Dana dicairkan", v: sm.disbursed },
    { u: "Modal diterima", v: sm.received, bold: true },
    ...(sm.by_product ?? []).map((p: any) => ({ u: `Pembelian ${p.product} (${kg(p.kg)}) dibayar tunai`, v: p.paid })),
    { u: "Panjar ke petani", v: sm.advances },
    ...(sm.advance_returned ? [{ u: "Pengembalian panjar dari petani", v: -sm.advance_returned }] : []),
    ...(sm.by_expense ?? []).map((e: any) => ({ u: e.category, v: e.total })),
    { u: "Total penggunaan", v: sm.used, bold: true },
    { u: "Disetor kembali", v: sm.returned },
    { u: "Sisa kas petugas", v: sm.remaining, bold: true },
  ];

  const canApprove = st === "submitted" && session.isOwner;
  const canDisburse = st === "approved";
  const canReview = st === "lpj_submitted" && !!l;
  const hasActions = canApprove || canDisburse || canReview;

  return (
    <div>
      <BackLink href="/modal" label="Modal petugas" />
      <PageHeader title={`Penugasan ${a.no ?? ""}`} desc={`${a.profiles?.full_name} · ${a.region ?? "-"} · diajukan ${jam(a.created_at)}`}>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <MessageCircle size={16} className="text-emerald-600" /> WhatsApp petugas
          </a>
        )}
        <ExportButtons filename={`LPJ-${a.no}`} rows={lpjRows.map((r) => ({ Uraian: r.u, Jumlah: r.v }))} />
      </PageHeader>

      <div className="space-y-5">
        {a.exception_id && <Alert tone="blue">Diajukan dengan pengecualian pemilik: {a.assignment_exceptions?.reason} (batas {rp(a.assignment_exceptions?.max_amount)})</Alert>}
        {rejected && <Alert tone="red">Pengajuan ditolak.{a.review_note ? ` Alasan: ${a.review_note}` : ""}</Alert>}
        {late && <Alert tone="red">Tenggat pertanggungjawaban {tgl(a.due_date)} sudah lewat.</Alert>}
        {st === "lpj_returned" && l?.review_note && <Alert tone="amber">LPJ dikembalikan ke petugas: {l.review_note}</Alert>}

        {!rejected && (
          <Card>
            <Steps
              steps={[
                { label: "Diajukan", done: idx > 0, sub: tgl(a.created_at) },
                { label: "Disetujui", done: idx > 1, sub: a.approver?.full_name },
                { label: "Dicairkan", done: idx > 2 },
                { label: "Diterima petugas", done: idx > 3, sub: a.received_confirmed_at ? tgl(a.received_confirmed_at) : undefined },
                { label: "LPJ", done: idx > 4, warn: st === "lpj_returned", sub: st === "lpj_returned" ? "Dikembalikan" : a.due_date ? `Tenggat ${tgl(a.due_date)}` : undefined },
                { label: "Selesai", done: st === "closed" },
              ]}
            />
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Modal diterima" value={rp(sm.received)} hint={Number(a.carry_over_amount) > 0 ? `termasuk saldo dibawa ${rp(a.carry_over_amount)}` : undefined} icon={ArrowDownLeft} tone="blue" />
          <Stat label="Penggunaan" value={rp(sm.used)} hint={received > 0 ? `${usedPct}% dari modal` : undefined} icon={Receipt} tone="amber" />
          <Stat label="Sisa kas (hitungan)" value={rp(sm.remaining)} hint={Number(sm.returned) > 0 ? `sudah disetor ${rp(sm.returned)}` : undefined} icon={PiggyBank} tone="green" />
          <Stat label="Saldo kas petugas" value={rp(fieldAcc.data?.balance)} hint="Semua penugasan" icon={Wallet} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className={`space-y-5 ${hasActions ? "lg:col-span-2" : "lg:col-span-3"}`}>
            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Pengajuan" actions={<Badge status={st} />}>
                <Info items={[
                  ["Petugas", a.profiles?.full_name], ["HP", a.profiles?.phone || "-"], ["Wilayah", a.region], ["Tujuan", a.purpose],
                  ["Diajukan", rp(a.requested_amount)], ["Saldo dibawa", rp(a.carry_over_amount)],
                  ["Biaya lapangan direncanakan", rp(plannedCost)],
                  ["Disetujui", a.approved_amount ? <b key="ap">{rp(a.approved_amount)}</b> : "-"],
                  ["Tenggat LPJ", a.due_date ? <span key="d" className={late ? "font-semibold text-red-600" : ""}>{tgl(a.due_date)}</span> : "-"],
                  ["Disetujui oleh", a.approver?.full_name], ["Dana dikonfirmasi diterima", jam(a.received_confirmed_at)], ["Catatan", a.review_note],
                ]} />
              </Card>
              <Card title="Rencana barang & biaya">
                <div className="space-y-2">
                  {(items.data ?? []).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm">
                      <Two main={it.products?.name} sub={`Perkiraan ${kg(it.est_weight_kg)} · rencana ${rp(it.plan_price)}/kg`} />
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Batas</div>
                        <div className="font-semibold tabular-nums">{it.approved_max_price ? `${rp(it.approved_max_price)}/kg` : "-"}</div>
                      </div>
                    </div>
                  ))}
                  {(items.data ?? []).length === 0 && <p className="text-sm text-slate-400">Tidak ada rencana barang</p>}
                </div>
                {(costs.data ?? []).length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-1 text-xs font-semibold text-slate-500">Biaya lapangan</div>
                    {(costs.data ?? []).map((c: any) => (
                      <div key={c.id} className="flex justify-between py-1 text-sm">
                        <span className="text-slate-600">{c.expense_categories?.name ?? c.description}</span>
                        <span className="tabular-nums">{rp(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card title="Pertanggungjawaban modal" desc={l ? `Dikirim ${jam(l.submitted_at)}` : "Belum dikirim petugas"} actions={l ? <Badge status={l.status === "returned" ? "lpj_returned" : l.status} /> : undefined}>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {lpjRows.map((r, i) => (
                      <tr key={i} className={r.bold ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-600"}>
                        <td className="px-4 py-2.5">{r.u}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{rp(r.v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {received > 0 && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Pemakaian modal</span><span>{usedPct}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${usedPct}%` }} /></div>
                </div>
              )}
              {l && (
                <div className="mt-5">
                  <Info items={[
                    ["Uang fisik dilaporkan", rp(l.cash_reported)],
                    ["Selisih kas", <span key="d" className={Number(l.cash_diff) !== 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{Number(l.cash_diff) !== 0 ? rp(l.cash_diff) : "Sesuai"}</span>],
                    ["Sisa kas", l.remaining_action === "return" ? "Disetor kembali" : "Saldo awal penugasan berikutnya"],
                    ["Catatan petugas", l.note], ["Diperiksa", l.reviewer ? `${l.reviewer.full_name} · ${jam(l.reviewed_at)}` : "-"], ["Catatan pemeriksa", l.review_note],
                  ]} />
                </div>
              )}
            </Card>

            {miss.length > 0 && (
              <Card title={`Bukti & konfirmasi belum lengkap (${miss.length})`} className="border-amber-200">
                <ul className="divide-y divide-slate-100">
                  {miss.map((m: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      {m.ref_type === "purchase" ? <Link className="font-semibold text-emerald-700 hover:underline" href={`/pembelian/${m.ref_id}`}>{m.ref_no}</Link> : <span className="font-semibold">{m.ref_no}</span>}
                      <span className="text-right text-amber-700">{m.problem}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div>
              <QuickTabs items={[
                { label: `Pembelian (${(purchases.data ?? []).length})`, href: `?tab=beli`, active: tab === "beli" },
                { label: `Panjar (${(advances.data ?? []).length})`, href: `?tab=panjar`, active: tab === "panjar" },
                { label: `Pengeluaran (${(expenses.data ?? []).length})`, href: `?tab=biaya`, active: tab === "biaya", count: pendingExp },
                { label: `Mutasi dana (${(transfers.data ?? []).length})`, href: `?tab=dana`, active: tab === "dana" },
              ]} />
              {tab === "beli" && (
                <Card padded={false}>
                  <Table rows={purchases.data ?? []} href={(r: any) => `/pembelian/${r.id}`} empty="Belum ada pembelian" cols={[
                    { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.purchase_date)} /> },
                    { key: "suppliers", label: "Petani / barang", render: (r: any) => <Two main={r.suppliers?.name} sub={r.products?.name} /> },
                    { key: "agreed_kg", label: "Berat", align: "right", render: (r: any) => kg(r.agreed_kg) },
                    { key: "price_per_kg", label: "Harga/kg", align: "right", render: (r: any) => <span className={r.over_limit ? "font-semibold text-red-600" : ""}>{rp(r.price_per_kg)}</span> },
                    { key: "total_amount", label: "Total", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.total_amount)}</span> },
                    { key: "paid_amount", label: "Dibayar", align: "right", render: (r: any) => rp(r.paid_amount) },
                    { key: "goods_status", label: "Barang", render: (r: any) => <Badge status={r.goods_status} /> },
                  ]} />
                </Card>
              )}
              {tab === "panjar" && (
                <Card padded={false}>
                  <Table rows={advances.data ?? []} empty="Belum ada panjar" cols={[
                    { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.given_at)} /> },
                    { key: "suppliers", label: "Petani", render: (r: any) => r.suppliers?.name },
                    { key: "amount", label: "Nominal", align: "right", render: (r: any) => rp(r.amount) },
                    { key: "remaining", label: "Sisa", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.remaining)}</span> },
                    { key: "status", label: "Status", render: (r: any) => <Badge status={r.status} /> },
                  ]} />
                </Card>
              )}
              {tab === "biaya" && (
                <Card padded={false}>
                  <Table rows={expenses.data ?? []} empty="Belum ada pengeluaran" cols={[
                    { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.expense_date)} /> },
                    { key: "expense_categories", label: "Kategori", render: (r: any) => <Two main={r.expense_categories?.name} sub={r.description} /> },
                    { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.amount)}</span> },
                    { key: "status", label: "Status", render: (r: any) => (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge status={r.status} />
                        {r.status === "submitted" && (
                          <>
                            <ActionForm action={reviewExpense} submit="Valid" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="valid" /></ActionForm>
                            <ActionForm action={reviewExpense} submit="Tolak" variant="ghost" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="rejected" /></ActionForm>
                          </>
                        )}
                      </div>
                    ) },
                  ]} />
                </Card>
              )}
              {tab === "dana" && (
                <Card>
                  <Table rows={transfers.data ?? []} empty="Belum ada mutasi dana" cols={[
                    { key: "no", label: "No / tanggal", render: (r: any) => <Two main={r.no} sub={tgl(r.transfer_date)} /> },
                    { key: "type", label: "Jenis", render: (r: any) => <Badge tone={r.type === "return" ? "green" : "violet"} label={r.type === "disbursement" ? "Pencairan" : r.type === "return" ? "Setoran kembali" : r.type} /> },
                    { key: "from", label: "Dari → ke", render: (r: any) => <Two main={r.from?.name} sub={`→ ${r.to?.name ?? "-"}`} /> },
                    { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.amount)}</span> },
                  ]} />
                  <div className="mt-5"><PhotoGrid refType="transfer" refIds={(transfers.data ?? []).map((t: any) => t.id)} title="Bukti pencairan & setoran" allowUpload={false} /></div>
                </Card>
              )}
            </div>

            <Card>
              <PhotoGrid refType={["purchase", "advance", "expense", "assignment", "lpj"]} allowUpload={false} title="Seluruh bukti penugasan"
                refIds={[a.id, ...(purchases.data ?? []).map((x: any) => x.id), ...(advances.data ?? []).map((x: any) => x.id), ...(expenses.data ?? []).map((x: any) => x.id)]} />
            </Card>
          </div>

          {/* Kolom aksi */}
          {hasActions && (
            <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
              {canApprove && (
                <>
                  <Card title="Setujui pengajuan" desc={`Diajukan ${rp(a.requested_amount)}`}>
                    <ActionForm action={approveAssignment} submit="Setujui">
                      <input type="hidden" name="id" value={a.id} />
                      <Field label="Batas dana disetujui" hint={a.carry_over_amount > 0 ? `Saldo dibawa ${rp(a.carry_over_amount)} — pencairan = disetujui − saldo dibawa` : undefined}>
                        <Input name="amount" type="number" step="any" defaultValue={a.requested_amount} required />
                      </Field>
                      <Field label="Tenggat pertanggungjawaban"><Input name="due_date" type="date" required defaultValue={new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)} /></Field>
                      {(items.data ?? []).map((it: any) => (
                        <div key={it.id}>
                          <input type="hidden" name="item_id" value={it.id} />
                          <Field label={`Batas harga ${it.products?.name} (Rp/kg)`}><Input name="item_price" type="number" step="any" defaultValue={it.plan_price ?? ""} /></Field>
                        </div>
                      ))}
                      <Field label="Catatan"><Textarea name="note" /></Field>
                    </ActionForm>
                  </Card>
                  <Collapse title="Tolak pengajuan" tone="danger">
                    <ActionForm action={rejectAssignment} submit="Tolak" variant="danger" confirm="Tolak pengajuan ini?">
                      <input type="hidden" name="id" value={a.id} />
                      <Field label="Alasan"><Textarea name="note" required /></Field>
                    </ActionForm>
                  </Collapse>
                </>
              )}

              {canDisburse && (
                <Card title="Pencairan dana" desc={`Disetujui ${rp(a.approved_amount)}${Number(a.carry_over_amount) > 0 ? ` − saldo dibawa ${rp(a.carry_over_amount)}` : ""}`}>
                  <ActionForm action={disburseAssignment} submit="Cairkan">
                    <input type="hidden" name="id" value={a.id} />
                    <Field label="Dari kas/bank"><Select name="from_account_id" options={opt.cash} required /></Field>
                    <Field label="Nominal dicairkan"><Input name="amount" type="number" step="any" defaultValue={toDisburse} required /></Field>
                    <Grid cols={2}>
                      <Field label="Tanggal"><Input name="date" type="date" defaultValue={today()} /></Field>
                      <Field label="Keterangan"><Input name="note" /></Field>
                    </Grid>
                    <Field label="Bukti transfer / serah terima"><Input name="files" type="file" multiple accept="image/*,application/pdf" /></Field>
                  </ActionForm>
                </Card>
              )}

              {canReview && (
                <>
                  {l.remaining_action === "return" && Number(sm.remaining) > 0 && (
                    <Card title="Catat setoran sisa kas" desc={`Sisa ${rp(sm.remaining)} disetor kembali`}>
                      <ActionForm action={recordReturn} submit="Simpan setoran">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="from_account_id" value={fieldAcc.data?.id ?? ""} />
                        <Field label="Masuk ke kas/bank"><Select name="to_account_id" options={opt.cash} required /></Field>
                        <Field label="Nominal"><Input name="amount" type="number" step="any" defaultValue={sm.remaining} required /></Field>
                        <Grid cols={2}>
                          <Field label="Tanggal"><Input name="date" type="date" defaultValue={today()} /></Field>
                          <Field label="Keterangan"><Input name="note" /></Field>
                        </Grid>
                      </ActionForm>
                    </Card>
                  )}
                  <Card title="Setujui pertanggungjawaban" desc={miss.length || Number(l.cash_diff) !== 0 ? "Masih ada bukti kurang atau selisih kas" : "Bukti lengkap dan kas sesuai"}>
                    <ActionForm action={reviewLpj} submit="Setujui LPJ">
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="approve" value="1" />
                      <Field label="Catatan"><Textarea name="note" /></Field>
                      {session.isOwner && (miss.length > 0 || Number(l.cash_diff) !== 0) && (
                        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                          <Input type="checkbox" name="force" className="mt-0.5" /> Setujui dengan pengecualian pemilik (bukti belum lengkap / ada selisih)
                        </label>
                      )}
                    </ActionForm>
                  </Card>
                  <Collapse title="Kembalikan ke petugas" desc="Minta petugas memperbaiki LPJ" tone="danger">
                    <ActionForm action={reviewLpj} submit="Kembalikan" variant="danger">
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="approve" value="0" />
                      <Field label="Yang perlu diperbaiki"><Textarea name="note" required /></Field>
                    </ActionForm>
                  </Collapse>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}