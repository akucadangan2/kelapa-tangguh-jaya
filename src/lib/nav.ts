import type { Session } from "@/lib/auth";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; icon: string; items: NavItem[] };

export function buildNav(s: Session): NavGroup[] {
  const office = s.isOffice;
  const wh = s.isWarehouse;
  const groups: (NavGroup | false)[] = [
    { label: "Dashboard", icon: "home", items: [{ href: "/dashboard", label: "Ringkasan" }, { href: "/notifikasi", label: "Notifikasi" }] },
    office && {
      label: "Petani & Lapangan", icon: "map",
      items: [{ href: "/petani", label: "Data Petani & Peta" }, { href: "/petani/kunjungan", label: "Kunjungan" }],
    },
    (office || wh) && {
      label: "Pembelian", icon: "cart",
      items: [{ href: "/pembelian", label: "Daftar Pembelian" }, ...(office ? [{ href: "/pembelian/panjar", label: "Panjar & Utang Petani" }] : [])],
    },
    office && { label: "Modal Petugas", icon: "wallet", items: [{ href: "/modal", label: "Pengajuan & LPJ" }, { href: "/modal/pengecualian", label: "Pengecualian" }] },
    (office || wh) && {
      label: "Gudang", icon: "box",
      items: [
        { href: "/gudang/stok", label: "Stok & Lot" },
        { href: "/gudang/mutasi", label: "Mutasi Stok" },
        { href: "/gudang/opname", label: "Stok Opname" },
        { href: "/gudang/penyesuaian", label: "Susut / Rusak / Pindah" },
        { href: "/gudang/perbandingan", label: "Perbandingan Berat" },
        { href: "/gudang/laporan-foto", label: "Laporan Foto Harian" },
      ],
    },
    (office || wh) && { label: "Produksi Arang", icon: "flame", items: [{ href: "/produksi", label: "Batch Produksi" }] },
    (office || wh || s.canSellPrice) && {
      label: "Pabrik & Penjualan", icon: "factory",
      items: [
        ...(office || s.canSellPrice ? [{ href: "/pabrik", label: "Pabrik & Harga" }] : []),
        { href: "/penjualan", label: "Penjualan & Pengiriman" },
        ...(office ? [{ href: "/penjualan/piutang", label: "Tagihan & Piutang" }] : []),
      ],
    },
    office && {
      label: "Kas & Keuangan", icon: "cash",
      items: [
        { href: "/kas", label: "Kas & Bank" },
        { href: "/kas/transfer", label: "Transfer & Modal" },
        { href: "/kas/pengeluaran", label: "Pengeluaran" },
        ...(s.canSalary ? [{ href: "/kas/gaji", label: "Gaji" }] : []),
        { href: "/kas/bonus", label: "Bonus" },
        { href: "/kas/rekonsiliasi", label: "Rekonsiliasi Bank" },
      ],
    },
    office && s.canProfit && {
      label: "Akuntansi", icon: "book",
      items: [{ href: "/akuntansi/jurnal", label: "Jurnal" }, { href: "/akuntansi/akun", label: "Bagan Akun & Saldo" }, { href: "/akuntansi/periode", label: "Tutup Periode" }],
    },
    (office || wh) && { label: "Laporan", icon: "chart", items: [{ href: "/laporan", label: "Semua Laporan" }] },
    s.isOwner && {
      label: "Pengaturan", icon: "settings",
      items: [
        { href: "/pengaturan/pengguna", label: "Pengguna & Hak Akses" },
        { href: "/pengaturan/master", label: "Data Master" },
        { href: "/pengaturan/aplikasi", label: "Aplikasi Android" },
        { href: "/pengaturan/aturan", label: "Aturan Sistem" },
        { href: "/pengaturan/audit", label: "Jejak Perubahan" },
      ],
    },
  ];
  return groups.filter(Boolean) as NavGroup[];
}
