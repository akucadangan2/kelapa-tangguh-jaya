import Link from "next/link";
import { ArrowLeftRight, Hourglass, PackageX, TrendingDown } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions, sp } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PhotoGrid } from "@/components/photo-grid";
import { Collapse, QuickTabs, Two } from "@/components/page-bits";
import { jam, kg } from "@/lib/format";
import { createAdjustment, setAdjustmentStatus } from "../actions";

export const metadata = { title: "Susut, rusak & pindah gudang" };

const TYPE: Record<string, string> = { shrink: "Susut", damage: "Rusak", transfer: "Pindah gudang" };
const TYPE_TONE: Record<string, "amber" | "red" | "blue"> = { shrink: "amber", damage: "red", transfer: "blue" };

export default async function Penyesuaian({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("owner", "finance", "warehouse");
  const f = sp(await searchParams);
  const supabase = await createClient();
  const opt = await getOptions(["warehouses"]);
  const [{ data }, { data: lots }] = await Promise.all([
    supabase.from("stock_adjustments").select("*, lots(id, code, products(name), warehouses(name)), to:to_warehouse_id(name), profiles:user_id(full_name), approver:approved_by(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("v_lot_balance").select("id, code, product_name, warehouse_name, balance_kg").gt("balance_kg", 0).order("code"),
  ]);
  const all = data ?? [];
  const pending = all.filter((r: any) => r.status === "submitted");
  const tab = f.tab === "all" ? "all" : pending.length ? "pending" : "all";
  const rows = tab === "pending" ? pending : f.type ? all.filter((r: any) => r.type === f.type) : all;
  const approved = all.filter((r: any) => r.status === "approved");
  const sum = (t: string) => approved.filter((r: any) => r.type === t).reduce((a: number, r: any) => a + Number(r.qty_kg), 0);

  return (
    <div>
      <PageHeader title="Susut, rusak & pindah gudang" desc="Setiap penyesuaian wajib alasan dan persetujuan kantor sebelum mengubah stok" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Menunggu persetujuan" value={pending.length} icon={Hourglass} tone={pending.length ? "amber" : "default"} href="/gudang/penyesuaian" />
        <Stat label="Total susut" value={kg(sum("shrink"))} hint="Yang sudah disetujui" icon={TrendingDown} tone="amber" />
        <Stat label="Total rusak" value={kg(sum("damage"))} hint="Yang sudah disetujui" icon={PackageX} tone="red" />
        <Stat label="Total pindah gudang" value={kg(sum("transfer"))} icon={ArrowLeftRight} tone="blue" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <QuickTabs items={[
            { label: "Menunggu persetujuan", href: "/gudang/penyesuaian", active: tab === "pending", count: pending.length },
            { label: "Semua", href: "/gudang/penyesuaian?tab=all", active: tab === "all" && !f.type },
            ...Object.entries(TYPE).map(([v, l]) => ({ label: l, href: `/gudang/penyesuaian?tab=all&type=${v}`, active: tab === "all" && f.type === v })),
          ]} />
          <Card padded={false}>
            <Table rows={rows} empty={tab === "pending" ? "Tidak ada penyesuaian yang menunggu" : "Belum ada penyesuaian"} cols={[
              { key: "no", label: "No / waktu", render: (r: any) => <Two main={r.no} sub={jam(r.created_at)} /> },
              { key: "lots", label: "Lot", render: (r: any) => <Two main={<Link className="text-emerald-700 hover:underline" href={`/gudang/lot/${r.lots?.id}`}>{r.lots?.code}</Link>} sub={`${r.lots?.products?.name ?? ""} · ${r.lots?.warehouses?.name ?? ""}`} /> },
              { key: "type", label: "Jenis", render: (r: any) => <Two main={<Badge tone={TYPE_TONE[r.type]} label={TYPE[r.type] ?? r.type} />} sub={r.to?.name ? `ke ${r.to.name}` : undefined} /> },
              { key: "qty_kg", label: "Berat", align: "right", render: (r: any) => <span className="font-semibold">{kg(r.qty_kg)}</span> },
              { key: "reason", label: "Alasan / oleh", render: (r: any) => <Two main={<span className="text-slate-700">{r.reason}</span>} sub={r.profiles?.full_name} /> },
              { key: "status", label: "Status", render: (r: any) => (
                <div className="flex flex-col items-start gap-2">
                  <Badge status={r.status} />
                  {r.status === "submitted" && s.isOffice && (
                    <div className="flex flex-wrap gap-1.5">
                      <ActionForm action={setAdjustmentStatus} submit="Setujui" inline confirm={`Setujui ${TYPE[r.type]?.toLowerCase()} ${kg(r.qty_kg)}?`}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="approved" /></ActionForm>
                      <ActionForm action={setAdjustmentStatus} submit="Tolak" variant="danger" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="rejected" /></ActionForm>
                    </div>
                  )}
                  {r.approver && <span className="text-xs text-slate-400">{r.approver.full_name}</span>}
                </div>
              ) },
            ]} />
          </Card>
          {rows.length > 0 && (
            <Collapse title="Foto penyesuaian" desc="Bukti foto dari aplikasi gudang">
              <PhotoGrid refType="adjustment" refIds={rows.map((r: any) => r.id)} title="" allowUpload={false} />
            </Collapse>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Ajukan penyesuaian" desc="Stok berubah setelah disetujui">
            <ActionForm action={createAdjustment} submit="Ajukan">
              <Field label="Lot"><Select name="lot_id" required placeholder="Pilih lot" options={(lots ?? []).map((l: any) => ({ value: l.id, label: `${l.code} · ${l.product_name} · ${l.warehouse_name} (${kg(l.balance_kg)})` }))} /></Field>
              <Grid cols={2}>
                <Field label="Jenis"><Select name="type" options={Object.entries(TYPE).map(([value, label]) => ({ value, label }))} /></Field>
                <Field label="Berat (kg)"><Input name="qty_kg" type="number" step="any" min="0" required /></Field>
              </Grid>
              <Field label="Ke gudang" hint="Hanya untuk pindah gudang"><Select name="to_warehouse_id" options={opt.warehouses} placeholder="-" /></Field>
              <Field label="Alasan"><Textarea name="reason" rows={3} required /></Field>
            </ActionForm>
            <div className="mt-4"><Alert tone="blue">Foto bukti dapat dilampirkan dari aplikasi gudang.</Alert></div>
          </Card>
        </div>
      </div>
    </div>
  );
}