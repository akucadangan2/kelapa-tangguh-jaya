import Link from "next/link";
import { notFound } from "next/navigation";
import { HandCoins, MapPin, Package, Scale, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Info, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { ExportButtons } from "@/components/export-buttons";
import { BackLink, Collapse, Steps } from "@/components/page-bits";
import { CONDITION, jam, kg, rp, tgl, today } from "@/lib/format";
import { addPurchasePayment, allocateAdvance, cancelPurchase, correctPurchase, receiveGoods, verifyPurchase } from "../actions";

export const metadata = { title: "Detail pembelian" };

const CONDS = [{ value: "dry", label: "Kering" }, { value: "wet", label: "Basah" }, { value: "mixed", label: "Campur" }];

export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("owner", "finance", "warehouse");
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("purchases")
    .select("*, suppliers(id, name, phone, address), products(name, code), quality_grades(name), profiles:user_id(full_name), assignments(id, no)")
    .eq("id", id).single();
  if (!p) notFound();
  const office = session.isOffice;
  const [weigh, pays, allocs, receipt, openAdv, opt] = await Promise.all([
    supabase.from("purchase_weighings").select("*").eq("purchase_id", id).order("seq"),
    supabase.from("purchase_payments").select("*, cash_accounts(name)").eq("purchase_id", id).order("paid_at"),
    supabase.from("advance_allocations").select("*, advances(no, given_at)").eq("purchase_id", id),
    supabase.from("goods_receipts").select("*, warehouses(name), vehicles(plate_no), lots(id, code), profiles:received_by(full_name)").eq("purchase_id", id).maybeSingle(),
    office ? supabase.from("advances").select("id, no, remaining").eq("supplier_id", p.supplier_id).eq("status", "open") : { data: [] },
    getOptions(["cash", "warehouses", "vehicles", "grades"]),
  ]);
  const r = receipt.data;
  const grades = opt.raw.grades.filter((g: any) => g.product_id === p.product_id).map((g: any) => ({ value: g.id, label: g.name }));
  const cancelled = p.status === "cancelled";
  const due = Number(p.balance_due ?? 0);
  const ledger = [
    ...(allocs.data ?? []).map((a: any) => ({ id: a.id, date: a.created_at, desc: `Potong panjar ${a.advances?.no ?? ""}`, kind: "Panjar", amount: a.amount })),
    ...(pays.data ?? []).map((x: any) => ({ id: x.id, date: x.paid_at, desc: `${x.cash_accounts?.name ?? "Kas"}${x.note ? " · " + x.note : ""}`, kind: "Bayar", amount: x.amount })),
  ];
  const sacks = (weigh.data ?? []).reduce((a: number, w: any) => a + Number(w.sacks ?? 0), 0);

  return (
    <div>
      <BackLink href="/pembelian" label="Pembelian" />
      <PageHeader title={`Pembelian ${p.no}`} desc={`${p.suppliers?.name ?? "-"} · ${tgl(p.purchase_date)} · ${p.profiles?.full_name ?? ""}`}>
        <ExportButtons filename={p.no} rows={(weigh.data ?? []).map((w: any) => ({ No: w.seq, Karung: w.sacks, Bruto: w.gross_kg, Tara: w.tare_kg, Netto: w.net_kg }))} />
      </PageHeader>

      <div className="space-y-5">
        {cancelled && <Alert tone="red">Pembelian ini dibatalkan.{p.correction_note ? ` Alasan: ${p.correction_note}` : ""}</Alert>}
        {p.over_limit && office && <Alert tone="red">Harga beli {rp(p.price_per_kg)}/kg melebihi batas disetujui {rp(p.max_price_at_purchase)}/kg.</Alert>}
        {!cancelled && p.correction_note && <Alert tone="blue">Catatan koreksi: {p.correction_note}</Alert>}

        {!cancelled && (
          <Card>
            <Steps
              steps={[
                { label: "Dicatat petugas", done: true, sub: jam(p.client_created_at) },
                { label: "Diverifikasi", done: p.status === "verified", sub: p.verified_at ? jam(p.verified_at) : "Menunggu" },
                { label: "Diterima gudang", done: !!r, sub: r ? jam(r.received_at) : p.goods_status === "at_supplier" ? "Masih di petani" : "Dalam perjalanan" },
                ...(office ? [{ label: "Lunas", done: due <= 0, sub: due > 0 ? `Sisa ${rp(due)}` : "Tidak ada utang" }] : []),
              ]}
            />
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Berat disepakati" value={kg(p.agreed_kg)} hint={`Netto ${kg(p.net_kg)}`} icon={Scale} tone="amber" />
          {office && <Stat label="Total pembelian" value={rp(p.total_amount)} hint={`${rp(p.price_per_kg)}/kg`} icon={Package} tone="green" />}
          {office && <Stat label="Dibayar + panjar" value={rp(Number(p.paid_amount ?? 0) + Number(p.advance_allocated ?? 0))} icon={Wallet} tone="blue" />}
          {office && <Stat label="Sisa utang" value={due > 0 ? rp(due) : "Lunas"} icon={HandCoins} tone={due > 0 ? "red" : "green"} />}
          {!office && <Stat label="Status barang" value={<Badge status={p.goods_status} />} icon={Package} />}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Kolom utama */}
          <div className={`space-y-5 ${office && !cancelled ? "lg:col-span-2" : "lg:col-span-3"}`}>
            <Card title="Data pembelian" actions={<div className="flex gap-1.5"><Badge status={p.goods_status} /><Badge status={p.status} /></div>}>
              <Info items={[
                ["Petani", <Link key="s" href={`/petani/${p.suppliers?.id}`} className="text-emerald-700 hover:underline">{p.suppliers?.name}</Link>],
                ["HP petani", p.suppliers?.phone || "-"],
                ["Petugas", p.profiles?.full_name],
                ["Penugasan", p.assignments ? <Link key="a" className="text-emerald-700 hover:underline" href={`/modal/${p.assignments.id}`}>{p.assignments.no}</Link> : "-"],
                ["Barang", `${p.products?.name}${p.quality_grades ? " · " + p.quality_grades.name : ""}`],
                ["Kondisi", CONDITION[p.condition] ?? "-"],
                ["Kadar air", p.moisture_pct ? `${p.moisture_pct}%` : "-"],
                ["Potongan berat", kg(p.deduction_kg)],
                ["Dicatat di HP", jam(p.client_created_at)],
                ["Diterima server", jam(p.created_at)],
              ]} />
              {p.lat && (
                <a
                  href={`https://maps.google.com/?q=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <MapPin size={16} className="text-emerald-600" />
                  Lokasi pembelian {p.gps_accuracy ? `(±${Math.round(p.gps_accuracy)} m)` : ""}
                </a>
              )}
            </Card>

            <Card title="Rincian timbang" desc={`${(weigh.data ?? []).length} kali timbang · ${sacks} karung`} padded={false}>
              <Table rows={weigh.data ?? []} cols={[
                { key: "seq", label: "#" }, { key: "sacks", label: "Karung", align: "right" },
                { key: "gross_kg", label: "Bruto", align: "right", render: (w: any) => kg(w.gross_kg) },
                { key: "tare_kg", label: "Tara", align: "right", render: (w: any) => kg(w.tare_kg) },
                { key: "net_kg", label: "Netto", align: "right", render: (w: any) => <span className="font-semibold">{kg(w.net_kg)}</span> },
              ]} footer={(weigh.data ?? []).length > 0 && (
                <tr><td>Total</td><td className="text-right">{sacks}</td>
                  <td className="text-right">{kg(p.gross_kg)}</td><td className="text-right">{kg(p.tare_kg)}</td><td className="text-right">{kg(p.net_kg)}</td></tr>
              )} />
            </Card>

            {office && (
              <Card title="Nilai pembelian">
                <Info items={[
                  ["Harga beli/kg", rp(p.price_per_kg)],
                  ["Batas harga", p.max_price_at_purchase ? rp(p.max_price_at_purchase) : "-"],
                  ["Berat dibayar", kg(p.agreed_kg)],
                  ["Potongan rupiah", rp(p.deduction_amount)],
                  ["Total pembelian", <b key="t">{rp(p.total_amount)}</b>],
                  ["Dipotong panjar", rp(p.advance_allocated)],
                  ["Dibayar", rp(p.paid_amount)],
                  ["Sisa utang ke petani", <b key="b" className={due > 0 ? "text-red-600" : "text-emerald-700"}>{due > 0 ? rp(due) : "Lunas"}</b>],
                ]} />
                {ledger.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 text-sm font-semibold text-slate-800">Riwayat pembayaran</div>
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                      {ledger.map((x) => (
                        <li key={x.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                          <Badge tone={x.kind === "Panjar" ? "amber" : "green"} label={x.kind} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-slate-700">{x.desc}</div>
                            <div className="text-xs text-slate-400">{tgl(x.date)}</div>
                          </div>
                          <span className="font-semibold tabular-nums">{rp(x.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            <Card title="Penerimaan gudang">
              {r ? (
                <Info items={[
                  ["No terima", r.no], ["Gudang", r.warehouses?.name],
                  ["Lot", <Link key="l" className="text-emerald-700 hover:underline" href={`/gudang/lot/${r.lots?.id}`}>{r.lots?.code}</Link>],
                  ["Berat diterima", kg(r.received_kg)],
                  ["Selisih vs netto beli", <span key="d" className={Math.abs(Number(r.diff_kg)) > 0 ? "font-semibold text-amber-700" : ""}>{kg(r.diff_kg)}</span>],
                  ["Kendaraan", r.vehicles?.plate_no], ["Sopir", r.driver_name], ["Lokasi simpan", r.storage_location],
                  ["Penerima", r.profiles?.full_name], ["Waktu", jam(r.received_at)],
                ]} />
              ) : cancelled ? (
                <p className="text-sm text-slate-400">Pembelian dibatalkan</p>
              ) : (
                <div className="space-y-4">
                  <Alert tone="amber">Barang belum diterima gudang. Biasanya dicatat petugas gudang dari aplikasi. Isi form di bawah bila dicatat dari kantor.</Alert>
                  <ActionForm action={receiveGoods} submit="Terima barang">
                    <input type="hidden" name="id" value={p.id} />
                    <Grid>
                      <Field label="Gudang"><Select name="warehouse_id" options={opt.warehouses} required /></Field>
                      <Field label="Berat diterima (kg)"><Input name="received_kg" type="number" step="any" defaultValue={p.net_kg} required /></Field>
                      <Field label="Jumlah karung"><Input name="sacks" type="number" /></Field>
                      <Field label="Kendaraan"><Select name="vehicle_id" options={opt.vehicles} placeholder="-" /></Field>
                      <Field label="Sopir"><Input name="driver_name" /></Field>
                      <Field label="Mutu"><Select name="grade_id" options={grades} placeholder="Sama dengan pembelian" /></Field>
                      <Field label="Kondisi"><Select name="condition" options={CONDS} placeholder="Sama dengan pembelian" /></Field>
                      <Field label="Lokasi simpan"><Input name="storage_location" /></Field>
                      <Field label="Catatan"><Input name="note" /></Field>
                    </Grid>
                  </ActionForm>
                </div>
              )}
            </Card>

            <Card><PhotoGrid refType={["purchase", "goods_receipt"]} refIds={[p.id, ...(r ? [r.id] : [])]} allowUpload={false} /></Card>
          </div>

          {/* Kolom aksi */}
          {office && !cancelled && (
            <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
              {p.status === "submitted" && (
                <Card title="Verifikasi" desc="Pastikan berat, harga dan foto bukti sudah sesuai">
                  <ActionForm action={verifyPurchase} submit="Verifikasi pembelian" inline>
                    <input type="hidden" name="id" value={p.id} />
                  </ActionForm>
                </Card>
              )}

              {due > 0 && (
                <Card title="Catat pembayaran" desc={`Sisa utang ${rp(due)}`}>
                  <ActionForm action={addPurchasePayment} submit="Simpan pembayaran">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Dari kas/bank"><Select name="cash_account_id" options={opt.cash} required /></Field>
                    <Field label="Nominal"><Input name="amount" type="number" step="any" defaultValue={due} required /></Field>
                    <Grid cols={2}>
                      <Field label="Tanggal"><Input name="paid_at" type="date" defaultValue={today()} /></Field>
                      <Field label="Keterangan"><Input name="note" /></Field>
                    </Grid>
                  </ActionForm>
                </Card>
              )}

              {due > 0 && (openAdv.data ?? []).length > 0 && (
                <Card title="Potong panjar" desc="Petani ini masih punya panjar terbuka">
                  <ActionForm action={allocateAdvance} submit="Potong panjar">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Panjar terbuka"><Select name="advance_id" options={(openAdv.data ?? []).map((a: any) => ({ value: a.id, label: `${a.no} (sisa ${rp(a.remaining)})` }))} /></Field>
                    <Field label="Nominal dipotong"><Input name="amount" type="number" step="any" required /></Field>
                  </ActionForm>
                </Card>
              )}

              <Card><PhotoGrid refType="purchase" refIds={[p.id]} title="Tambah bukti" kinds={["goods", "scale", "receipt", "other"]} /></Card>

              <Collapse title="Koreksi pembelian" desc="Ubah harga, potongan, mutu atau kondisi">
                <ActionForm action={correctPurchase} submit="Simpan koreksi" reset={false}>
                  <input type="hidden" name="id" value={p.id} />
                  <Field label="Harga beli/kg"><Input name="price_per_kg" type="number" step="any" defaultValue={p.price_per_kg} /></Field>
                  <Grid cols={2}>
                    <Field label="Potongan berat (kg)"><Input name="deduction_kg" type="number" step="any" defaultValue={p.deduction_kg} /></Field>
                    <Field label="Potongan rupiah"><Input name="deduction_amount" type="number" step="any" defaultValue={p.deduction_amount} /></Field>
                    <Field label="Mutu"><Select name="grade_id" options={grades} defaultValue={p.grade_id ?? ""} placeholder="-" /></Field>
                    <Field label="Kondisi"><Select name="condition" defaultValue={p.condition ?? ""} options={CONDS} placeholder="-" /></Field>
                  </Grid>
                  <Field label="Alasan koreksi"><Textarea name="correction_note" required /></Field>
                </ActionForm>
              </Collapse>

              {!r && (
                <Collapse title="Batalkan pembelian" desc="Hanya bila transaksi tidak jadi" tone="danger">
                  <ActionForm action={cancelPurchase} submit="Batalkan" variant="danger" confirm="Batalkan pembelian ini?">
                    <input type="hidden" name="id" value={p.id} />
                    <Field label="Alasan pembatalan"><Textarea name="correction_note" required /></Field>
                  </ActionForm>
                </Collapse>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}