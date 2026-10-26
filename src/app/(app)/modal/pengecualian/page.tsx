import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOptions } from "@/lib/options";
import { Alert, Badge, Card, Field, Grid, Input, PageHeader, Select, Stat, Table, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Two } from "@/components/page-bits";
import { jam, rp, tgl } from "@/lib/format";
import { grantException } from "../actions";

export const metadata = { title: "Kunci pengajuan modal" };

export default async function Pengecualian() {
  const s = await requireRole("owner", "finance");
  const supabase = await createClient();
  const opt = await getOptions(["officers"]);
  const { data } = await supabase.from("assignment_exceptions").select("*, profiles:user_id(full_name), approver:approved_by(full_name)").order("created_at", { ascending: false });
  const checks = await Promise.all(opt.officers.map(async (o) => {
    const { data: c } = await supabase.rpc("can_request_capital", { p_user: o.value });
    return { id: o.value, name: o.label, ...(c as any) };
  }));
  const locked = checks.filter((c: any) => !c.allowed).length;
  const unused = (data ?? []).filter((e: any) => !e.used_at).length;

  return (
    <div>
      <PageHeader title="Kunci & pengecualian pengajuan modal" desc="Pengajuan modal baru terkunci sampai pertanggungjawaban sebelumnya selesai" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat label="Boleh mengajukan" value={checks.length - locked} hint={`dari ${checks.length} petugas`} icon={LockOpen} tone="green" />
        <Stat label="Terkunci" value={locked} icon={Lock} tone={locked ? "red" : "default"} />
        <Stat label="Pengecualian belum dipakai" value={unused} icon={ShieldCheck} tone={unused ? "violet" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Status per petugas" padded={false}>
            <Table rows={checks} empty="Belum ada petugas lapangan" cols={[
              { key: "name", label: "Petugas" },
              { key: "allowed", label: "Status", render: (r: any) => (r.allowed ? <Badge tone="green" label="Boleh mengajukan" /> : <Badge tone="red" label="Terkunci" />) },
              { key: "reasons", label: "Alasan", render: (r: any) => ((r.reasons ?? []).length ? <ul className="list-disc space-y-0.5 pl-4 text-slate-600">{(r.reasons as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="text-slate-400">-</span>) },
              { key: "carry_over", label: "Saldo dibawa", align: "right", render: (r: any) => (Number(r.carry_over) ? rp(r.carry_over) : "-") },
            ]} />
          </Card>

          <Card title="Riwayat pengecualian" padded={false}>
            <Table rows={data ?? []} empty="Belum ada pengecualian" cols={[
              { key: "profiles", label: "Petugas / dibuat", render: (r: any) => <Two main={r.profiles?.full_name} sub={jam(r.created_at)} /> },
              { key: "reason", label: "Alasan", render: (r: any) => <span className="text-slate-600">{r.reason}</span> },
              { key: "max_amount", label: "Batas", align: "right", render: (r: any) => <span className="font-semibold">{rp(r.max_amount)}</span> },
              { key: "due_date", label: "Tenggat", render: (r: any) => tgl(r.due_date) },
              { key: "used_at", label: "Status", render: (r: any) => (r.used_at ? <Two main={<Badge tone="gray" label="Sudah dipakai" />} sub={jam(r.used_at)} /> : <Badge tone="violet" label="Belum dipakai" />) },
              { key: "approver", label: "Oleh", render: (r: any) => r.approver?.full_name },
            ]} />
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {s.isOwner ? (
            <Card title="Berikan pengecualian" desc="Berlaku untuk satu kali pengajuan">
              <div className="mb-4">
                <Alert>Saldo dan kewajiban lama tetap tercatat dan terlihat. Petugas tetap wajib menyelesaikan pertanggungjawaban sebelumnya.</Alert>
              </div>
              <ActionForm action={grantException}>
                <Field label="Petugas"><Select name="user_id" options={opt.officers} required placeholder="Pilih petugas" /></Field>
                <Grid cols={2}>
                  <Field label="Batas nominal"><Input name="max_amount" type="number" step="any" required /></Field>
                  <Field label="Tenggat penyelesaian"><Input name="due_date" type="date" required /></Field>
                </Grid>
                <Field label="Alasan tertulis"><Textarea name="reason" rows={3} required /></Field>
              </ActionForm>
            </Card>
          ) : (
            <Alert tone="blue">Pengecualian hanya dapat diberikan oleh pemilik.</Alert>
          )}
        </div>
      </div>
    </div>
  );
}