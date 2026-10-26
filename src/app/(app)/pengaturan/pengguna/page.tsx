import { ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, Field, Grid, Input, PageHeader, Stat } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { Collapse } from "@/components/page-bits";
import { ROLE_LABEL } from "@/lib/format";
import { createUser, updateUser } from "../actions";

export const metadata = { title: "Pengguna & hak akses" };

const ROLES = ["owner", "finance", "field", "warehouse"];
const chip = "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-800";

function RoleFlags({ roles = [] as string[], p = {} as any }) {
  return (
    <div className="space-y-4">
      <Field label="Peran">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label key={r} className={chip}><input type="checkbox" name="roles" value={r} defaultChecked={roles.includes(r)} className="accent-emerald-600" /> {ROLE_LABEL[r]}</label>
          ))}
        </div>
      </Field>
      <Field label="Izin tambahan" hint="Pemilik selalu dapat melihat semua data">
        <div className="flex flex-wrap gap-2">
          <label className={chip}><input type="checkbox" name="can_view_sell_price" defaultChecked={p.can_view_sell_price} className="accent-emerald-600" /> Harga jual</label>
          <label className={chip}><input type="checkbox" name="can_view_salary" defaultChecked={p.can_view_salary} className="accent-emerald-600" /> Gaji</label>
          <label className={chip}><input type="checkbox" name="can_view_profit" defaultChecked={p.can_view_profit} className="accent-emerald-600" /> Laba & akuntansi</label>
        </div>
      </Field>
    </div>
  );
}

export default async function Pengguna() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*, user_roles(role)").order("full_name");
  const users = (data ?? []).map((p: any) => ({ ...p, roles: (p.user_roles ?? []).map((r: any) => r.role) as string[] }));
  const active = users.filter((u) => u.is_active);
  const count = (r: string) => active.filter((u) => u.roles.includes(r)).length;

  return (
    <div>
      <PageHeader title="Pengguna & hak akses" desc="Satu orang dapat memegang beberapa peran" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Pengguna aktif" value={active.length} hint={`dari ${users.length} akun`} icon={UserCheck} tone="green" />
        <Stat label="Petugas lapangan" value={count("field")} icon={Users} tone="blue" />
        <Stat label="Gudang & keuangan" value={count("warehouse") + count("finance")} hint={`${count("warehouse")} gudang · ${count("finance")} keuangan`} icon={ShieldCheck} tone="violet" />
        <Stat label="Nonaktif" value={users.length - active.length} icon={UserX} tone={users.length - active.length ? "red" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Alert tone="blue">Pemilik selalu dapat melihat semua data. Izin harga jual, gaji dan laba berlaku untuk peran lain.</Alert>
          {users.map((p) => (
            <Collapse
              key={p.id}
              title={`${p.full_name || "(tanpa nama)"}${p.is_active ? "" : " · nonaktif"}`}
              desc={[p.roles.map((r) => ROLE_LABEL[r]).join(", ") || "Belum ada peran", p.phone].filter(Boolean).join(" · ")}
            >
              <ActionForm action={updateUser} reset={false} submit="Simpan perubahan">
                <input type="hidden" name="id" value={p.id} />
                <Grid cols={2}>
                  <Field label="Nama"><Input name="full_name" defaultValue={p.full_name} /></Field>
                  <Field label="HP"><Input name="phone" defaultValue={p.phone ?? ""} inputMode="tel" /></Field>
                  <Field label="Password baru" hint="Kosongkan bila tidak diganti"><Input name="password" type="password" autoComplete="new-password" /></Field>
                  <Field label="Status">
                    <label className={chip}><input type="checkbox" name="is_active" defaultChecked={p.is_active} className="accent-emerald-600" /> Akun aktif</label>
                  </Field>
                </Grid>
                <RoleFlags roles={p.roles} p={p} />
              </ActionForm>
            </Collapse>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card title="Tambah pengguna" desc="Pengguna masuk memakai email dan password">
            <ActionForm action={createUser} submit="Buat akun">
              <Field label="Nama"><Input name="full_name" required /></Field>
              <Field label="Email (untuk login)"><Input name="email" type="email" required /></Field>
              <Field label="HP"><Input name="phone" inputMode="tel" /></Field>
              <Field label="Password awal" hint="Minimal 8 karakter"><Input name="password" type="password" minLength={8} required autoComplete="new-password" /></Field>
              <RoleFlags />
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}