import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Alert } from "@/components/ui";
import { SITE } from "@/lib/site";
import logo from "../logo.png";
import { login } from "./actions";

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel kiri (desktop) */}
      <div className="relative hidden overflow-hidden bg-emerald-900 lg:block">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-emerald-700/40 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-3">
            <Image src={logo} alt={SITE.name} width={44} height={44} className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
            <span className="text-lg font-bold">{SITE.name}</span>
          </Link>
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Satu sistem untuk pembelian, gudang, produksi dan keuangan.</h2>
            <p className="mt-4 text-emerald-100/90">Data dari petugas lapangan dan gudang masuk langsung ke kantor. Laporan selalu terbaru.</p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
              {["Pembelian", "Stok & lot", "Laporan"].map((t) => (
                <div key={t} className="rounded-xl bg-white/10 px-3 py-3 text-center font-medium ring-1 ring-white/10">{t}</div>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-200/70">{SITE.region}</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Image src={logo} alt={SITE.name} width={64} height={64} className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-sm ring-1 ring-slate-200" />
            <div className="mt-3 text-lg font-bold text-slate-900">{SITE.name}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">Masuk</h1>
            <p className="mb-6 mt-1 text-sm text-slate-500">Gunakan akun yang diberikan pemilik atau admin.</p>
            {e === "norole" && (
              <div className="mb-4">
                <Alert tone="red">Akun belum memiliki peran. Hubungi pemilik/admin.</Alert>
              </div>
            )}
            <ActionForm action={login} submit="Masuk" reset={false}>
              <Field label="Email">
                <Input name="email" type="email" required autoComplete="email" placeholder="nama@email.com" />
              </Field>
              <Field label="Password">
                <Input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
              </Field>
            </ActionForm>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Petugas lapangan dan gudang memakai aplikasi Android.{" "}
            <Link href="/unduh" className="font-medium text-emerald-700 hover:underline">Unduh aplikasi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}