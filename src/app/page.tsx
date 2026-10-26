import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  ArrowRight, Banknote, Bell, BarChart3, CalendarCheck, Camera, CheckCircle2, ClipboardCheck, Clock,
  Factory, FileCheck2, Flame, HandCoins, Headset, Layers, Mail, MapPin, MessageCircle, Package, Phone,
  Printer, ReceiptText, Scale, ShieldCheck, Truck, Users, Wallet, WifiOff, Warehouse, Map, Home, History, User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SITE, waLink } from "@/lib/site";
import { MobileNav } from "./_landing/mobile-nav";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: `${SITE.name} | Pembeli Kopra, Tempurung & Arang di ${SITE.region}`,
  description: `${SITE.name} membeli kopra, tempurung dan arang tempurung langsung dari petani di ${SITE.region}. Dijemput ke lokasi, ditimbang terbuka, dibayar tunai atau transfer.`,
  openGraph: { title: SITE.name, description: SITE.tagline, type: "website" },
};

const HIGHLIGHTS = [
  { icon: Truck, title: "Dijemput ke lokasi", text: "Petugas datang ke kebun atau rumah Anda." },
  { icon: Scale, title: "Timbang terbuka", text: "Setiap karung ditimbang di depan penjual." },
  { icon: Banknote, title: "Tunai atau transfer", text: "Pembayaran langsung setelah ditimbang." },
  { icon: ReceiptText, title: "Struk resmi", text: "Rincian timbang dan harga tertulis jelas." },
];

const PRODUCTS = [
  { icon: Package, name: "Kopra", text: "Daging kelapa yang sudah dikeringkan. Mutu dan kondisi dicek bersama di lokasi sebelum ditimbang." },
  { icon: Layers, name: "Tempurung", text: "Tempurung kelapa dari petani dan pengepul, dalam jumlah kecil maupun besar." },
  { icon: Flame, name: "Arang Tempurung", text: "Arang hasil pembakaran tempurung kelapa, dipisah sesuai mutu." },
];

const STEPS = [
  { icon: CalendarCheck, title: "Hubungi kami", text: "Kirim lokasi, jenis barang dan perkiraan jumlah karung lewat WhatsApp." },
  { icon: Truck, title: "Petugas datang", text: "Petugas datang sesuai jadwal dan mengecek mutu barang bersama Anda." },
  { icon: Scale, title: "Timbang di depan Anda", text: "Berat kotor, berat karung dan berat bersih dicatat per karung." },
  { icon: Banknote, title: "Terima pembayaran", text: "Dibayar tunai atau transfer, disertai struk resmi." },
];

const APP_FIELD = [
  { icon: Map, title: "Data petani & peta lokasi", text: "Alamat, titik GPS, petunjuk jalan dan navigasi ke lokasi petani." },
  { icon: Camera, title: "Kunjungan dengan foto & GPS", text: "Catat ketersediaan barang, perkiraan berat dan jadwal pengambilan." },
  { icon: Scale, title: "Pembelian timbang per karung", text: "Berat kotor, berat karung dan berat bersih dihitung otomatis." },
  { icon: Printer, title: "Cetak struk di tempat", text: "Struk dicetak lewat printer Bluetooth atau dikirim ke WhatsApp." },
  { icon: HandCoins, title: "Panjar petani", text: "Panjar tercatat per petani dan dipotong otomatis saat pembelian." },
  { icon: Wallet, title: "Modal & pertanggungjawaban", text: "Pengajuan dana, pengeluaran lapangan dan laporan penggunaan dana." },
  { icon: WifiOff, title: "Tetap bekerja tanpa sinyal", text: "Data tersimpan di HP dan terkirim otomatis saat ada sinyal." },
];

const APP_WAREHOUSE = [
  { icon: Warehouse, title: "Terima barang", text: "Berat diterima, mutu dan lokasi simpan dicatat per lot dengan foto." },
  { icon: Truck, title: "Barang keluar & surat jalan", text: "Pengiriman ke pembeli lengkap dengan foto timbang dan muatan." },
  { icon: Factory, title: "Diterima pembeli", text: "Berat dan potongan dari pembeli dicatat beserta tanda terima." },
  { icon: ClipboardCheck, title: "Stok & stok opname", text: "Stok per produk, mutu, gudang dan lot, serta hitung fisik berkala." },
  { icon: Flame, title: "Pencatatan produksi arang", text: "Bahan terpakai, hasil, susut dan rendemen per batch." },
];

const OFFICE = [
  { icon: BarChart3, title: "Dashboard & laporan", text: "Pembelian, penjualan, stok, kas dan laba, bisa diekspor ke Excel dan PDF." },
  { icon: ShieldCheck, title: "Persetujuan & pemeriksaan", text: "Persetujuan dana petugas dan pemeriksaan bukti foto setiap transaksi." },
  { icon: Bell, title: "Pengingat otomatis", text: "Notifikasi ke HP untuk persetujuan, tagihan jatuh tempo dan laporan terlambat." },
];

export default async function Landing() {
  let loggedIn = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    loggedIn = !!data.user;
  } catch {}
  const loginHref = loggedIn ? "/dashboard" : "/login";
  const loginLabel = loggedIn ? "Buka Dashboard" : "Masuk Staf";

  const waSeller = waLink(
    `Halo ${SITE.name}, saya ingin menjual barang.\nNama:\nLokasi/desa:\nJenis barang (kopra/tempurung/arang):\nPerkiraan jumlah karung:`,
    SITE.whatsappFarmer,
  );
  const waBuyer = waLink(
    `Halo ${SITE.name}, saya ingin membeli.\nNama / usaha:\nProduk (kopra/tempurung/arang):\nJumlah yang dibutuhkan:\nLokasi pengiriman:`,
    SITE.whatsappBuyer,
  );
  const waCS = waLink(`Halo ${SITE.name}, saya ingin bertanya.`);

  return (
    <div className={`${font.className} bg-white text-slate-800 antialiased`}>
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-700 text-sm font-bold text-white">KT</span>
            <span className="truncate text-[15px] font-bold leading-tight text-slate-900 sm:text-base">{SITE.name}</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#produk" className="hover:text-emerald-700">Produk</a>
            <a href="#cara-jual" className="hover:text-emerald-700">Cara Jual</a>
            <a href="#aplikasi" className="hover:text-emerald-700">Aplikasi</a>
            <a href="#pembeli" className="hover:text-emerald-700">Untuk Pembeli</a>
            <a href="#kontak" className="hover:text-emerald-700">Kontak</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link href={loginHref} className="text-sm font-semibold text-slate-600 hover:text-emerald-700">{loginLabel}</Link>
            <a href={waCS} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              Hubungi Kami
            </a>
          </div>
          <MobileNav loginHref={loginHref} loginLabel={loginLabel} />
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-b from-emerald-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pb-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
              <MapPin size={13} /> {SITE.region}
            </span>
            <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[44px]">
              Pembeli Kopra, Tempurung &amp; Arang Tempurung Langsung dari Petani
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              {SITE.name} menjemput barang ke lokasi Anda, menimbang setiap karung secara terbuka, dan membayar tunai atau transfer dengan struk resmi.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={waSeller} target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3.5 font-semibold text-white shadow-sm hover:bg-emerald-800">
                <MessageCircle size={19} /> Jual Sekarang
              </a>
              <a href="#cara-jual"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50">
                Lihat Cara Jual <ArrowRight size={18} />
              </a>
            </div>
            <ul className="mt-7 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {["Kopra, tempurung & arang", "Panjar untuk petani mitra", `Buka ${SITE.hours}`, "Struk setiap transaksi"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> {t}</li>
              ))}
            </ul>
          </div>

          {/* Contoh struk timbang */}
          <Receipt />
        </div>
      </section>

      {/* KEUNGGULAN */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-slate-200 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="bg-white p-5 sm:p-6">
              <h.icon size={24} className="text-emerald-700" />
              <p className="mt-3 text-sm font-bold text-slate-900 sm:text-base">{h.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 sm:text-sm">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUK */}
      <section id="produk" className="scroll-mt-16 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Heading kicker="Produk" title="Barang yang Kami Beli" text={`Kami membeli langsung dari petani dan pengepul di ${SITE.region}.`} />
          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3 md:gap-6">
            {PRODUCTS.map((p) => (
              <div key={p.name} className="rounded-2xl border border-slate-200 p-6 transition hover:border-emerald-300 hover:shadow-sm">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><p.icon size={24} /></div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{p.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CARA JUAL */}
      <section id="cara-jual" className="scroll-mt-16 bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Heading kicker="Cara Jual" title="Empat Langkah Menjual ke Kami" />
          <ol className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-col lg:p-6">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <HandCoins size={26} className="shrink-0 text-amber-700" />
            <div>
              <h3 className="font-bold text-slate-900">Panjar untuk petani mitra</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-slate-600">Panjar dapat diberikan sesuai kesepakatan dan dipotong pada penjualan berikutnya, dengan rincian tertulis di struk.</p>
            </div>
          </div>
        </div>
      </section>

      {/* APLIKASI */}
      <section id="aplikasi" className="scroll-mt-16 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
            <div>
              <Heading
                kicker="Aplikasi Kami"
                title="Setiap Transaksi Tercatat di Aplikasi"
                text="Petugas lapangan dan gudang memakai aplikasi Android yang terhubung langsung dengan kantor. Setiap pembelian, pembayaran dan pengiriman tercatat dengan foto, lokasi dan waktu."
              />
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Foto", "setiap bukti"],
                  ["GPS", "lokasi transaksi"],
                  ["Offline", "tanpa sinyal"],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-xl bg-emerald-50 px-2 py-3">
                    <p className="font-bold text-emerald-800">{a}</p>
                    <p className="text-xs text-slate-600">{b}</p>
                  </div>
                ))}
              </div>
            </div>
            <PhoneMockup />
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <FeatureGroup title="Untuk petugas lapangan" icon={Users} items={APP_FIELD} />
            <FeatureGroup title="Untuk gudang" icon={Warehouse} items={APP_WAREHOUSE} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <p className="text-sm font-semibold text-emerald-700">Website kantor</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {OFFICE.map((f) => (
                <div key={f.title} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200"><f.icon size={19} /></span>
                  <div>
                    <p className="font-semibold text-slate-900">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PEMBELI */}
      <section id="pembeli" className="scroll-mt-16 bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Heading kicker="Untuk Pembeli" title="Pasokan untuk Pabrik, Distributor dan Perorangan" text="Barang disimpan per lot sesuai asal, mutu dan tanggal masuk. Setiap pengiriman dilengkapi foto timbang dan surat jalan." />
          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 md:gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <Factory size={26} className="text-emerald-700" />
              <h3 className="mt-4 text-lg font-bold text-slate-900">Kopra untuk pabrik</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">Kopra disalurkan ke pabrik pengolahan. Tagihan dibuat sesuai berat yang diterima pabrik.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <Users size={26} className="text-emerald-700" />
              <h3 className="mt-4 text-lg font-bold text-slate-900">Tempurung &amp; arang untuk distributor dan perorangan</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">Tersedia untuk distributor maupun pembeli perorangan, dipisah sesuai mutu.</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-3 text-[15px] text-slate-700 sm:grid-cols-3">
            {[
              { icon: FileCheck2, t: "Tagihan sesuai berat diterima" },
              { icon: Camera, t: "Foto timbang & surat jalan" },
              { icon: Truck, t: "Antar atau ambil di gudang" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <x.icon size={20} className="shrink-0 text-emerald-700" /> {x.t}
              </li>
            ))}
          </ul>
          <a href={waBuyer} target="_blank" rel="noreferrer"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3.5 font-semibold text-white hover:bg-slate-800 sm:w-auto">
            <MessageCircle size={19} /> Tanyakan Pasokan
          </a>
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="scroll-mt-16 bg-emerald-800 py-14 text-white sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-200">Kontak</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">Ingin menjual kopra, tempurung atau arang?</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-emerald-100 sm:text-base">Hubungi kami lewat WhatsApp. Kami akan membalas dengan jadwal penjemputan.</p>
            <a href={waSeller} target="_blank" rel="noreferrer"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-3.5 font-semibold text-emerald-800 hover:bg-emerald-50 sm:w-auto">
              <MessageCircle size={19} /> Chat WhatsApp
            </a>
          </div>
          <div className="rounded-2xl bg-white p-6 text-slate-800 sm:p-7">
            <ul className="divide-y divide-slate-100">
              <ContactRow icon={Headset} label="Customer Service (WhatsApp)" value={SITE.csDisplay} href={waCS} />
              {SITE.phone && <ContactRow icon={Phone} label="Telepon" value={SITE.phone} href={`tel:${SITE.phone.replace(/\D/g, "")}`} />}
              {SITE.email && <ContactRow icon={Mail} label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />}
              <ContactRow icon={MapPin} label="Alamat Gudang" value={SITE.address} href={SITE.mapsUrl} />
              <ContactRow icon={Clock} label="Jam Operasional" value={SITE.hours} />
            </ul>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 pb-24 pt-10 text-sm text-slate-400 md:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-white">{SITE.name}</p>
            <p className="mt-1">{SITE.tagline}</p>
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <p>© {new Date().getFullYear()} {SITE.name}</p>
            <Link href={loginHref} className="font-semibold text-emerald-400 hover:text-emerald-300">{loginLabel}</Link>
          </div>
        </div>
      </footer>

      {/* Tombol WhatsApp mengambang */}
      <a href={waSeller} target="_blank" rel="noreferrer" aria-label="Chat WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 font-semibold text-white shadow-lg shadow-black/20 hover:brightness-95">
        <MessageCircle size={22} /> <span className="hidden sm:inline">Chat WhatsApp</span>
      </a>
    </div>
  );
}

/* ---------- Komponen ---------- */

function Heading({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-emerald-700">{kicker}</p>
      <h2 className="mt-2 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">{title}</h2>
      {text && <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">{text}</p>}
    </div>
  );
}

function Receipt() {
  return (
    <div className="mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
      <div className="rounded-t-2xl border border-b-0 border-slate-200 bg-white px-5 pb-4 pt-5 font-mono text-[12.5px] text-slate-800 shadow-xl shadow-slate-900/10 sm:px-6">
        <div className="flex items-start justify-between border-b border-dashed border-slate-300 pb-3">
          <div>
            <p className="font-bold tracking-wide text-slate-900">BUKTI PEMBELIAN</p>
            <p className="mt-0.5 font-sans text-[11px] font-medium text-slate-500">{SITE.name}</p>
          </div>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-emerald-700">Contoh</span>
        </div>
        <div className="space-y-0.5 py-3">
          <Row k="No" v="PB-2610-0042" />
          <Row k="Barang" v="Kopra · Grade A" />
          <Row k="Kondisi" v="Kering" />
        </div>
        <div className="border-t border-dashed border-slate-300 py-3">
          <p className="mb-1.5 font-sans text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Rincian timbang</p>
          <Row k="#1  10 krg  520 − 10" v="510 kg" />
          <Row k="#2  10 krg  498 − 10" v="488 kg" />
          <Row k="#3   8 krg  402 −  8" v="394 kg" />
        </div>
        <div className="space-y-0.5 border-t border-dashed border-slate-300 py-3">
          <Row k="Netto" v="1.392 kg" />
          <Row k="Potongan berat" v="12 kg" />
          <Row k="Berat dibayar" v="1.380 kg" bold />
          <Row k="Harga/kg" v="Rp12.000" />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-emerald-700 px-3 py-2.5 text-white">
          <span className="font-bold">TOTAL</span>
          <span className="font-bold">Rp16.560.000</span>
        </div>
        <p className="mt-3 text-center font-sans text-[11px] text-slate-400">Angka dan harga hanya ilustrasi</p>
      </div>
      <div
        aria-hidden
        className="h-3 w-full"
        style={{
          background:
            "linear-gradient(-45deg, transparent 6px, #fff 0) 0 0 / 12px 12px repeat-x, linear-gradient(45deg, transparent 6px, #fff 0) 0 0 / 12px 12px repeat-x",
          filter: "drop-shadow(0 6px 6px rgba(15,23,42,0.08))",
        }}
      />
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold text-slate-900" : ""}`}>
      <span className="whitespace-pre text-slate-500">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

/** Tiruan layar beranda aplikasi petugas lapangan */
function PhoneMockup() {
  return (
    <div className="mx-auto w-[260px] shrink-0 rounded-[2.4rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/25 sm:w-[280px]">
      <div className="overflow-hidden rounded-[1.7rem] bg-slate-100">
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 px-4 pb-5 pt-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/70">Selamat pagi</p>
              <p className="text-sm font-bold">Petugas Lapangan</p>
            </div>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold">Tersinkron</span>
          </div>
          <div className="mt-4 rounded-xl bg-white/12 p-3" style={{ background: "rgba(255,255,255,0.12)" }}>
            <p className="text-[10px] text-white/75">Saldo kas di tangan</p>
            <p className="text-xl font-extrabold">Rp8.450.000</p>
          </div>
        </div>
        <div className="space-y-2.5 p-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-900">PM-2610-0007</p>
              <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[8.5px] font-semibold text-sky-700">Berjalan</span>
            </div>
            <p className="mt-1 text-[9.5px] text-slate-500">Batas harga kopra Rp12.500/kg</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { i: Scale, v: "1.380 kg", l: "Beli hari ini" },
              { i: Banknote, v: "Rp16,5 jt", l: "Nilai beli" },
              { i: HandCoins, v: "Rp1 jt", l: "Panjar" },
              { i: Truck, v: "2", l: "Ke gudang" },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
                <x.i size={14} className="text-emerald-700" />
                <p className="mt-1.5 text-[11px] font-bold text-slate-900">{x.v}</p>
                <p className="text-[8.5px] text-slate-500">{x.l}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-[10px] font-semibold text-white">+ Catat</span>
          </div>
        </div>
        <div className="grid grid-cols-4 border-t border-slate-200 bg-white py-2 text-center text-[8.5px] text-slate-500">
          {[
            { i: Home, l: "Beranda", on: true },
            { i: Users, l: "Petani" },
            { i: History, l: "Riwayat" },
            { i: User, l: "Akun" },
          ].map((x) => (
            <div key={x.l} className={x.on ? "font-bold text-emerald-700" : ""}>
              <x.i size={14} className="mx-auto" />
              <p className="mt-0.5">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureGroup({ title, icon: Icon, items }: { title: string; icon: any; items: { icon: any; title: string; text: string }[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-700 text-white"><Icon size={18} /></span>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      <ul className="mt-5 space-y-4">
        {items.map((f) => (
          <li key={f.title} className="flex gap-3">
            <f.icon size={20} className="mt-0.5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-semibold text-slate-900">{f.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  const inner = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon size={19} /></span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="block break-words font-semibold text-slate-900">{value}</span>
      </span>
    </>
  );
  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 hover:opacity-80">{inner}</a>
      ) : (
        <div className="flex items-center gap-3">{inner}</div>
      )}
    </li>
  );
}