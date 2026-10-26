export const rp = (n: any) =>
  n === null || n === undefined || n === ""
    ? "-"
    : "Rp" + Number(n).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export const kg = (n: any, d = 2) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString("id-ID", { maximumFractionDigits: d }) + " kg";

export const num = (n: any, d = 2) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString("id-ID", { maximumFractionDigits: d });

export const pct = (n: any) => (n === null || n === undefined ? "-" : Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + "%");

export const tgl = (d: any) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";

export const jam = (d: any) =>
  d
    ? new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
    : "-";

export const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const monthStart = () => today().slice(0, 8) + "01";

export const STATUS: Record<string, { label: string; tone: "gray" | "blue" | "green" | "amber" | "red" | "violet" }> = {
  // penugasan
  submitted: { label: "Diajukan", tone: "blue" },
  approved: { label: "Disetujui", tone: "green" },
  rejected: { label: "Ditolak", tone: "red" },
  disbursed: { label: "Dicairkan", tone: "violet" },
  active: { label: "Berjalan", tone: "blue" },
  lpj_submitted: { label: "LPJ diperiksa", tone: "amber" },
  lpj_returned: { label: "LPJ dikembalikan", tone: "red" },
  closed: { label: "Selesai", tone: "gray" },
  cancelled: { label: "Batal", tone: "gray" },
  returned: { label: "Dikembalikan", tone: "red" },
  // pembelian / barang
  verified: { label: "Terverifikasi", tone: "green" },
  at_supplier: { label: "Di petani", tone: "amber" },
  in_transit: { label: "Dalam perjalanan", tone: "amber" },
  received: { label: "Diterima", tone: "green" },
  available: { label: "Tersedia", tone: "green" },
  in_production: { label: "Diproduksi", tone: "violet" },
  shipped: { label: "Terkirim", tone: "gray" },
  // penjualan
  confirmed: { label: "Pesanan", tone: "blue" },
  invoiced: { label: "Ditagih", tone: "amber" },
  partial: { label: "Sebagian", tone: "amber" },
  unpaid: { label: "Belum bayar", tone: "red" },
  paid: { label: "Lunas", tone: "green" },
  // lain
  open: { label: "Terbuka", tone: "amber" },
  settled: { label: "Selesai", tone: "gray" },
  running: { label: "Berjalan", tone: "blue" },
  done: { label: "Selesai", tone: "green" },
  valid: { label: "Valid", tone: "green" },
  pending: { label: "Belum diperiksa", tone: "amber" },
  indicative: { label: "Indikatif", tone: "amber" },
  expired: { label: "Kedaluwarsa", tone: "red" },
};

export const ROLE_LABEL: Record<string, string> = {
  owner: "Pemilik/Admin",
  finance: "Keuangan",
  field: "Petugas Lapangan",
  warehouse: "Gudang/Produksi",
};

export const ATTACH_KIND: Record<string, string> = {
  goods: "Barang",
  scale: "Timbangan",
  receipt: "Bukti/Nota",
  location: "Lokasi",
  arrival: "Barang tiba",
  storage: "Lokasi simpan",
  load: "Muatan",
  delivery_note: "Surat jalan",
  factory_scale: "Timbang pabrik",
  factory_receipt: "Tanda terima pabrik",
  before: "Sebelum proses",
  after: "Hasil akhir",
  transfer: "Bukti transfer",
  other: "Lainnya",
};

export const CONDITION: Record<string, string> = { wet: "Basah", dry: "Kering", mixed: "Campur" };
