import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, PackageCheck, Truck, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Info, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { BackLink, Collapse, Steps, Two } from "@/components/page-bits";
import { jam, kg, rp, tgl, today } from "@/lib/format";
import { addInvoicePayment, allocateLot, cancelOrder, createDispatch, createInvoice, recordFactoryReceipt, recordReturn, removeAllocation } from "../actions";

export const metadata = { title: "Detail penjualan" };

const ORDER_LABEL: Record<string, string> = { confirmed: "Pesanan", shipped: "Terkirim", received: "Diterima pabrik", invoiced: "Ditagih", closed: "Lunas", cancelled: "Batal" };
const DISPATCH_LABEL: Record<string, string> = { in_transit: "Dalam perjalanan", received: "Diterima pabrik", partial: "Sebagian/retur" };

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
      {items.map(([l, v]) => (
        <div key={l} className="bg-white px-3.5 py-2.5">
          <div className="text-xs text-slate-500">{l}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{v ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const { id } = await params;
  const supabase = await createClient();
  const { data: o } = await supabase.from("sales_orders").select("*, factories(*), products(name, id)").eq("id", id).single();
  if (!o) notFound();
  const office = s.isOffice;
  const price = office || s.canSellPrice;

  const [alloc, dispatches, invoices, freeLots, opt] = await Promise.all([
    supabase.from("sales_order_lots").select("*, lots(id, code, warehouse_id, warehouses(name))").eq("sales_order_id", id),
    supabase.from("goods_dispatches").select("*, warehouses(name), vehicles(plate_no), profiles:user_id(full_name), dispatch_lots(*, lots(code)), factory_receipts(*), sales_returns(*)").eq("sales_order_id", id).order("dispatched_at"),
    office ? supabase.from("invoices").select("*, invoice_payments(*, cash_accounts(name))").eq("sales_order_id", id) : { data: [] },
    supabase.from("v_lot_balance").select("id, code, warehouse_name, free_kg, grade_name").eq("product_id", o.product_id).gt("free_kg", 0).order("created_at"),
    getOptions(["warehouses", "vehicles", "cash"]),
  ]);
  const allocRows = alloc.data ?? [];
  const allocated = allocRows.reduce((a: number, r: any) => a + Number(r.qty_kg), 0);
  const ds = dispatches.data ?? [];
  const shipped = ds.reduce((a: number, d: any) => a + Number(d.total_kg), 0);
  const invs = (invoices.data ?? []).filter((i: any) => i.status !== "cancelled");
  const invByDispatch = new Map(invs.map((i: any) => [i.dispatch_id, i]));
  const closed = ["closed", "cancelled"].includes(o.status);
  const frOf = (d: any) => (Array.isArray(d.factory_receipts) ? d.factory_receipts[0] : d.factory_receipts);
  const receivedKg = ds.reduce((a: number, d: any) => a + Number(frOf(d)?.received_kg ?? 0), 0);
  const receivable = invs.reduce((a: number, i: any) => a + Number(i.total_amount) - Number(i.paid_amount), 0);
  const allReceived = ds.length > 0 && ds.every((d: any) => frOf(d));
  const allInvoiced = ds.length > 0 && ds.every((d: any) => invByDispatch.has(d.id));
  const paid = o.status === "closed";

  return (
    <div>
      <BackLink href="/penjualan" label="Penjualan" />
      <PageHeader title={`Penjualan ${o.no}`} desc={`${o.factories?.name} · ${o.products?.name} · ${tgl(o.order_date)}`}>
        <Badge status={o.status} label={ORDER_LABEL[o.status]} />
      </PageHeader>

      <div className="space-y-5">
        {o.status !== "cancelled" && (
          <Card>
            <Steps steps={[
              { label: "Pesanan", done: true, sub: kg(o.order_kg) },
              { label: "Lot dialokasikan", done: allocated > 0, sub: allocated ? kg(allocated) : "Belum", warn: !closed && allocated === 0 },
              { label: "Dikirim", done: ds.length > 0, sub: ds.length ? kg(shipped) : "Belum" },
              { label: "Diterima pabrik", done: allReceived, sub: receivedKg ? kg(receivedKg) : "Belum" },
              ...(office ? [{ label: "Ditagih", done: allInvoiced, sub: invs.length ? `${invs.length} tagihan` : "Belum" }, { label: "Lunas", done: paid, sub: paid ? "Selesai" : receivable ? `Sisa ${rp(receivable)}` : "Belum" }] : []),
            ]} />
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Pesanan" value={kg(o.order_kg)} hint={price ? `${rp(o.price_per_kg)}/kg` : undefined} icon={ClipboardList} />
          <Stat label="Lot dialokasikan" value={kg(allocated)} hint={Number(o.order_kg) > allocated ? `Kurang ${kg(Number(o.order_kg) - allocated)}` : "Sudah cukup"} icon={PackageCheck} tone={Number(o.order_kg) > allocated && !closed ? "amber" : "green"} />
          <Stat label="Sudah dikirim" value={kg(shipped)} hint={receivedKg ? `Diterima ${kg(receivedKg)}` : `${ds.length} pengiriman`} icon={Truck} tone="blue" />
          {office && <Stat label="Piutang" value={rp(receivable)} hint={invs.length ? `${invs.length} tagihan` : "Belum ada tagihan"} icon={Wallet} tone={receivable > 0 ? "amber" : "default"} />}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card title="Alokasi lot" desc="Stok yang dipesan untuk pesanan ini" padded={false}>
              <Table rows={allocRows} empty="Belum ada lot dialokasikan" cols={[
                { key: "lots", label: "Lot / gudang", render: (r: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/gudang/lot/${r.lots?.id}`}>{r.lots?.code}</Link>} sub={r.lots?.warehouses?.name} /> },
                { key: "qty_kg", label: "Dialokasikan", align: "right", render: (r: any) => <span className="font-semibold">{kg(r.qty_kg)}</span> },
                ...(office && !closed ? [{ key: "x", label: "", align: "right" as const, render: (r: any) => <ActionForm action={removeAllocation} submit="Lepas" variant="ghost" inline confirm="Lepas alokasi lot ini?"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="order_id" value={o.id} /></ActionForm> }] : []),
              ]} />
              {office && !closed && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                  <ActionForm action={allocateLot} submit="Alokasikan">
                    <input type="hidden" name="order_id" value={o.id} />
                    <Grid cols={2}>
                      <Field label="Lot tersedia"><Select name="lot_id" required placeholder="Pilih lot" options={(freeLots.data ?? []).map((l: any) => ({ value: l.id, label: `${l.code} · ${l.warehouse_name}${l.grade_name ? ` · ${l.grade_name}` : ""} (bebas ${kg(l.free_kg)})` }))} /></Field>
                      <Field label="Berat (kg)"><Input name="qty_kg" type="number" step="any" min="0" required /></Field>
                    </Grid>
                  </ActionForm>
                </div>
              )}
            </Card>

            {!closed && allocRows.length > 0 && (
              <Collapse title="Catat barang keluar gudang" desc="Isi berat keluar per lot sesuai timbangan" open={ds.length === 0}>
                <ActionForm action={createDispatch} submit="Simpan barang keluar">
                  <input type="hidden" name="order_id" value={o.id} />
                  <Grid cols={2}>
                    <Field label="Gudang"><Select name="warehouse_id" options={opt.warehouses} required placeholder="Pilih gudang" /></Field>
                    <Field label="Kendaraan"><Select name="vehicle_id" options={opt.vehicles} placeholder="-" /></Field>
                    <Field label="Sopir"><Input name="driver_name" /></Field>
                    <Field label="No. surat jalan"><Input name="delivery_note_no" /></Field>
                    {office && <Field label="Ongkos kirim (info)"><Input name="freight_cost" type="number" step="any" min="0" /></Field>}
                    <Field label="Foto timbangan / muatan / surat jalan"><Input type="file" name="files" multiple accept="image/*,application/pdf" /></Field>
                  </Grid>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead><tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500"><th className="px-4 py-2.5">Lot</th><th className="px-4 py-2.5 text-right">Dialokasikan</th><th className="w-44 px-4 py-2.5">Berat keluar (kg)</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{allocRows.map((a: any) => (
                        <tr key={a.id}>
                          <td className="px-4 py-2"><Two main={a.lots?.code} sub={a.lots?.warehouses?.name} /><input type="hidden" name="lot_id" value={a.lot_id} /></td>
                          <td className="px-4 py-2 text-right tabular-nums">{kg(a.qty_kg)}</td>
                          <td className="px-4 py-2"><Input name="qty_kg" type="number" step="any" min="0" placeholder="0" /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <Field label="Catatan"><Input name="note" /></Field>
                </ActionForm>
              </Collapse>
            )}

            {ds.map((d: any) => {
              const fr = frOf(d);
              const inv: any = invByDispatch.get(d.id);
              const returnedKg = (d.sales_returns ?? []).reduce((a: number, r: any) => a + Number(r.qty_kg), 0);
              return (
                <Card key={d.id} title={`Pengiriman ${d.no}`} desc={`${jam(d.dispatched_at)} · ${d.warehouses?.name ?? "-"}`} actions={<Badge status={d.status} label={DISPATCH_LABEL[d.status]} />}>
                  <div className="space-y-5">
                    <Facts items={[
                      ["Berat keluar", kg(d.total_kg)], ["Kendaraan", d.vehicles?.plate_no || "-"], ["Sopir", d.driver_name || "-"], ["Surat jalan", d.delivery_note_no || "-"],
                      ...(office ? [["Ongkos kirim", rp(d.freight_cost)] as [string, any], ["Nilai pokok", rp(d.cost_amount)] as [string, any]] : []),
                      ["Petugas", d.profiles?.full_name || "-"],
                      ["Lot", (d.dispatch_lots ?? []).map((x: any) => `${x.lots?.code} (${kg(x.qty_kg)})`).join(", ") || "-"],
                    ]} />

                    {fr ? (
                      <div>
                        <div className="mb-2 text-sm font-semibold text-slate-800">Penerimaan pabrik</div>
                        <Facts items={[
                          ["Diterima", kg(fr.received_kg)],
                          ["Selisih", <span key="d" className={Number(fr.diff_kg) !== 0 ? "text-amber-700" : ""}>{kg(fr.diff_kg)}</span>],
                          ["Potongan berat", kg(fr.deduction_kg)],
                          ...(office ? [["Potongan rupiah", rp(fr.deduction_amount)] as [string, any]] : []),
                          ["Mutu", fr.quality_note || "-"], ["Penerima", fr.receiver_name || "-"], ["Waktu", jam(fr.received_at)], ["Retur", returnedKg ? kg(returnedKg) : "-"],
                        ]} />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-800">Catat diterima pabrik</div>
                        <ActionForm action={recordFactoryReceipt} submit="Simpan penerimaan">
                          <input type="hidden" name="dispatch_id" value={d.id} /><input type="hidden" name="order_id" value={o.id} />
                          <Grid cols={2}>
                            <Field label="Berat diterima pabrik (kg)"><Input name="received_kg" type="number" step="any" min="0" defaultValue={d.total_kg} required /></Field>
                            <Field label="Potongan berat (kg)"><Input name="deduction_kg" type="number" step="any" min="0" /></Field>
                            {office && <Field label="Potongan rupiah"><Input name="deduction_amount" type="number" step="any" min="0" /></Field>}
                            <Field label="Catatan mutu"><Input name="quality_note" /></Field>
                            <Field label="Nama penerima"><Input name="receiver_name" /></Field>
                            <Field label="Tanggal terima"><Input name="received_at" type="date" defaultValue={today()} /></Field>
                          </Grid>
                          <Field label="Bukti timbang & tanda terima"><Input type="file" name="files" multiple accept="image/*,application/pdf" /></Field>
                        </ActionForm>
                      </div>
                    )}

                    <PhotoGrid refType={["dispatch", "factory_receipt"]} refIds={[d.id, ...(fr ? [fr.id] : [])]} title="Foto pengiriman & penerimaan" allowUpload={false} />

                    {fr && !inv && (
                      <Collapse title="Catat retur / barang ditolak" tone="danger">
                        <ActionForm action={recordReturn} submit="Simpan retur">
                          <input type="hidden" name="dispatch_id" value={d.id} /><input type="hidden" name="order_id" value={o.id} />
                          <Grid>
                            <Field label="Lot"><Select name="lot_id" options={(d.dispatch_lots ?? []).map((x: any) => ({ value: x.lot_id, label: x.lots?.code }))} /></Field>
                            <Field label="Berat (kg)"><Input name="qty_kg" type="number" step="any" min="0" required /></Field>
                            <Field label="Tindakan"><Select name="action" options={[{ value: "return_to_warehouse", label: "Kembali ke gudang" }, { value: "redirect", label: "Dialihkan ke pabrik lain" }, { value: "pending", label: "Masih dalam penyelesaian" }]} /></Field>
                          </Grid>
                          <Field label="Keterangan"><Input name="note" /></Field>
                        </ActionForm>
                      </Collapse>
                    )}

                    {office && fr && !inv && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-800">Buat tagihan</div>
                        <ActionForm action={createInvoice} submit="Buat tagihan">
                          <input type="hidden" name="dispatch_id" value={d.id} /><input type="hidden" name="order_id" value={o.id} />
                          <Grid cols={2}>
                            <Field label="Berat ditagih (kg)" hint="Diterima − potongan − retur"><Input name="accepted_kg" type="number" step="any" min="0" defaultValue={Number(fr.received_kg) - Number(fr.deduction_kg ?? 0) - returnedKg} required /></Field>
                            <Field label="Harga/kg"><Input name="price_per_kg" type="number" step="any" min="0" defaultValue={o.price_per_kg} required /></Field>
                            <Field label="Potongan rupiah"><Input name="deduction_amount" type="number" step="any" min="0" defaultValue={fr.deduction_amount} /></Field>
                            <Field label="Tanggal tagihan"><Input name="invoice_date" type="date" defaultValue={today()} /></Field>
                            <Field label="Jatuh tempo"><Input name="due_date" type="date" defaultValue={new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)} /></Field>
                          </Grid>
                        </ActionForm>
                      </div>
                    )}

                    {office && inv && (
                      <div className="rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                          <div className="text-sm font-semibold text-slate-800">Tagihan {inv.no}</div>
                          <Badge status={inv.status} />
                        </div>
                        <div className="p-4">
                          <Facts items={[
                            ["Berat ditagih", kg(inv.accepted_kg)], ["Harga/kg", rp(inv.price_per_kg)], ["Potongan", rp(inv.deduction_amount)], ["Total tagihan", rp(inv.total_amount)],
                            ["Dibayar", rp(inv.paid_amount)],
                            ["Sisa piutang", <span key="s" className={Number(inv.total_amount) - Number(inv.paid_amount) > 0 ? "text-amber-700" : "text-emerald-700"}>{rp(Number(inv.total_amount) - Number(inv.paid_amount))}</span>],
                            ["Jatuh tempo", tgl(inv.due_date)],
                            ["Laba kotor", <span key="l" className={Number(inv.total_amount) - Number(inv.cogs_amount) < 0 ? "text-red-600" : "text-emerald-700"}>{rp(Number(inv.total_amount) - Number(inv.cogs_amount))}</span>],
                          ]} />
                          <p className="mt-2 text-xs text-slate-500">HPP {rp(inv.cogs_amount)}</p>
                        </div>
                        {(inv.invoice_payments ?? []).length > 0 && (
                          <div className="border-t border-slate-100">
                            <Table rows={inv.invoice_payments ?? []} cols={[
                              { key: "paid_at", label: "Tanggal bayar", render: (r: any) => tgl(r.paid_at) },
                              { key: "cash_accounts", label: "Masuk ke", render: (r: any) => r.cash_accounts?.name },
                              { key: "amount", label: "Nominal", align: "right", render: (r: any) => <span className="font-semibold text-emerald-700">{rp(r.amount)}</span> },
                            ]} />
                          </div>
                        )}
                        {inv.status !== "paid" && (
                          <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                            <ActionForm action={addInvoicePayment} submit="Catat pembayaran">
                              <input type="hidden" name="invoice_id" value={inv.id} /><input type="hidden" name="order_id" value={o.id} />
                              <Grid cols={2}>
                                <Field label="Masuk ke"><Select name="cash_account_id" options={opt.cash} required placeholder="Pilih kas/bank" /></Field>
                                <Field label="Nominal"><Input name="amount" type="number" step="any" min="0" defaultValue={Number(inv.total_amount) - Number(inv.paid_amount)} required /></Field>
                                <Field label="Tanggal"><Input name="paid_at" type="date" defaultValue={today()} /></Field>
                                <Field label="Keterangan"><Input name="note" /></Field>
                              </Grid>
                            </ActionForm>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Card title="Pabrik tujuan">
              <Info items={[
                ["Pabrik", o.factories?.name], ["Lokasi", o.factories?.location || "-"],
                ["Kontak", [o.factories?.contact_name, o.factories?.phone].filter(Boolean).join(" · ") || "-"],
                ["Basis penyerahan", o.delivery_basis === "franco" ? "Franco pabrik" : o.delivery_basis === "loco" ? "Loco gudang" : o.delivery_basis || "-"],
                ...(price ? [["Harga/kg", rp(o.price_per_kg)] as [string, any]] : []),
                ["Spesifikasi mutu", o.factories?.quality_spec || "-"], ["Catatan", o.note || "-"],
              ]} />
            </Card>
            {office && o.status === "confirmed" && ds.length === 0 && (
              <Collapse title="Batalkan pesanan" tone="danger">
                <div className="mb-4"><Alert>Alokasi lot akan dilepas kembali menjadi stok bebas.</Alert></div>
                <ActionForm action={cancelOrder} submit="Batalkan pesanan" variant="danger" confirm="Batalkan pesanan ini?">
                  <input type="hidden" name="order_id" value={o.id} />
                  <Field label="Alasan"><Textarea name="note" rows={2} required /></Field>
                </ActionForm>
              </Collapse>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}