export type TourKey = "menu" | "bell" | "header" | "export" | "progress" | "stats" | "tabs" | "filter" | "collapse" | "table" | "side" | "list";

export type PageTour = {
  id: string;
  match: RegExp;
  title: string;
  intro: string;
  order?: TourKey[];
  text?: Partial<Record<TourKey, string>>;
};

export const DEFAULT_ORDER: TourKey[] = ["header", "export", "progress", "stats", "tabs", "filter", "collapse", "table", "side"];

export const DEFAULT_TEXT: Record<TourKey, { title: string; body: string }> = {
  menu: { title: "Menu utama", body: "Semua menu ada di sini. Angka kuning di samping menu menunjukkan jumlah pekerjaan yang menunggu, misalnya pembelian yang belum diverifikasi." },
  bell: { title: "Notifikasi", body: "Pengingat otomatis dan pemberitahuan persetujuan masuk ke sini. Angka kuning menunjukkan notifikasi yang belum dibaca." },
  header: { title: "Judul halaman", body: "Nama halaman dan periode data yang sedang ditampilkan." },
  export: { title: "Excel & cetak", body: "Unduh data yang sedang tampil ke Excel, atau cetak halaman ini. Filter yang dipilih ikut terbawa." },
  progress: { title: "Alur proses", body: "Tahapan transaksi ini. Lingkaran hijau berarti tahap sudah selesai, lingkaran bergaris berarti tahap yang sedang berjalan." },
  stats: { title: "Ringkasan", body: "Angka penting pada halaman ini. Kartu yang bisa diklik akan membuka daftar yang sesuai." },
  tabs: { title: "Tab cepat", body: "Pindah tampilan dengan sekali klik. Angka kuning di tab menunjukkan jumlah data yang perlu ditindaklanjuti." },
  filter: { title: "Filter", body: "Saring data berdasarkan tanggal atau pilihan lain, lalu tekan Terapkan. Tekan Reset untuk kembali ke tampilan awal." },
  collapse: { title: "Bagian buka-tutup", body: "Klik judul bagian ini untuk membuka atau menutup isinya, misalnya form tambah data, peta atau foto." },
  table: { title: "Daftar data", body: "Klik nomor atau nama di kolom pertama untuk membuka detail." },
  side: { title: "Form input", body: "Isi kolom yang diperlukan, lalu tekan tombol simpan di bagian bawah form. Pesan berhasil atau gagal akan muncul di samping tombol." },
  list: { title: "Daftar", body: "Pilih salah satu untuk membukanya." },
};

export const TOURS: PageTour[] = [
  {
    id: "dashboard", match: /^\/dashboard$/, title: "Selamat datang",
    intro: "Panduan singkat ini menjelaskan bagian-bagian website. Tekan Lanjut untuk mulai, atau Lewati bila sudah paham. Panduan bisa diulang dari tombol Panduan di pojok kanan bawah.",
    order: ["menu", "bell", "header", "stats", "table"],
    text: { header: "Sapaan dan periode ringkasan. Tombol di sebelah kanan membuka menu yang sering dipakai.", stats: "Ringkasan usaha: pembelian, stok, penjualan dan kas pada periode ini." },
  },
  { id: "notifikasi", match: /^\/notifikasi$/, title: "Notifikasi", intro: "Daftar pengingat dan pemberitahuan untuk akun Anda. Klik notifikasi untuk membuka transaksi terkait.", text: { tabs: "Pilih Belum dibaca untuk melihat notifikasi yang belum dibuka." } },

  { id: "petani-kunjungan", match: /^\/petani\/kunjungan$/, title: "Kunjungan lapangan", intro: "Laporan kunjungan petugas ke petani, lengkap dengan lokasi GPS dan perkiraan barang.", text: { collapse: "Peta titik kunjungan. Klik titik untuk membuka data petani.", table: "Kolom GPS berwarna hijau bila akurasi lokasi baik (30 m atau lebih dekat)." } },
  { id: "petani-detail", match: /^\/petani\/[^/]+$/, title: "Detail petani", intro: "Riwayat pembelian, panjar dan kunjungan untuk satu petani. Tombol WhatsApp dan Navigasi ada di kanan atas.", text: { tabs: "Pindah antara Pembelian, Panjar, Kunjungan dan Ubah data.", side: "Profil petani, peta lokasi dan foto." } },
  { id: "petani", match: /^\/petani$/, title: "Petani & pemasok", intro: "Data seluruh petani: kontak, lokasi, barang yang tersedia, jadwal ambil dan saldo panjar.", text: { tabs: "Saring per jenis barang, atau pilih Jadwal ambil untuk melihat petani yang akan diambil barangnya.", collapse: "Buka bagian ini untuk menambah petani baru atau melihat peta lokasi." } },

  { id: "pembelian-panjar", match: /^\/pembelian\/panjar$/, title: "Panjar & utang petani", intro: "Uang panjar yang diberikan ke petani dan utang pembelian yang belum dibayar.", text: { tabs: "Saldo per petani menampilkan total panjar dan utang. Daftar panjar menampilkan setiap transaksi panjar.", side: "Catat panjar dari kantor atau pengembalian panjar oleh petani." } },
  { id: "pembelian-detail", match: /^\/pembelian\/[^/]+$/, title: "Detail pembelian", intro: "Rincian satu pembelian: timbangan, harga, pembayaran, foto dan status barang.", text: { side: "Tombol verifikasi, pembayaran dan pembatalan ada di sini sesuai hak akses." } },
  { id: "pembelian", match: /^\/pembelian$/, title: "Daftar pembelian", intro: "Semua pembelian dari petani, baik yang dicatat petugas lewat aplikasi maupun dari kantor.", text: { tabs: "Belum diverifikasi berisi pembelian yang perlu diperiksa kantor. Menuju gudang berisi barang yang belum diterima gudang." } },

  { id: "modal-pengecualian", match: /^\/modal\/pengecualian$/, title: "Kunci pengajuan modal", intro: "Pengajuan modal petugas terkunci bila pertanggungjawaban sebelumnya belum selesai. Pemilik dapat memberi pengecualian satu kali.", text: { side: "Form pengecualian, hanya untuk pemilik." } },
  { id: "modal-detail", match: /^\/modal\/[^/]+$/, title: "Detail modal petugas", intro: "Rincian satu penugasan: pengajuan, pencairan, penggunaan dana dan LPJ.", text: { tabs: "Lihat pembelian, panjar, biaya dan mutasi dana dari penugasan ini.", side: "Tombol setujui, cairkan dan periksa LPJ ada di sini sesuai tahapnya." } },
  { id: "modal", match: /^\/modal$/, title: "Modal petugas lapangan", intro: "Pengajuan modal dari petugas, persetujuan, pencairan dan pertanggungjawaban (LPJ).", text: { tabs: "Perlu disetujui, Siap dicairkan dan LPJ diperiksa berisi pekerjaan yang menunggu kantor." } },

  { id: "gudang-lot", match: /^\/gudang\/lot\/[^/]+$/, title: "Riwayat lot", intro: "Perjalanan satu lot barang: asal pembelian, masuk gudang, pergerakan stok, sampai diterima pabrik.", text: { table: "Setiap pergerakan stok lot ini beserta saldo berjalan." } },
  { id: "gudang-stok", match: /^\/gudang\/stok$/, title: "Stok & lot", intro: "Stok dipisahkan per produk, mutu, gudang dan lot. Lot paling lama tampil paling atas supaya dijual lebih dulu.", text: { table: "Klik kode lot untuk melihat riwayatnya. Umur lot lebih dari 30 hari ditandai kuning." } },
  { id: "gudang-mutasi", match: /^\/gudang\/mutasi$/, title: "Mutasi stok", intro: "Semua barang masuk dan keluar gudang pada periode yang dipilih." },
  { id: "gudang-opname", match: /^\/gudang\/opname$/, title: "Stok opname", intro: "Hasil hitung fisik barang per lot. Saldo stok baru berubah setelah opname disetujui kantor.", text: { tabs: "Buat opname baru untuk mencatat hitung fisik dari website." } },
  { id: "gudang-penyesuaian", match: /^\/gudang\/penyesuaian$/, title: "Susut, rusak & pindah gudang", intro: "Pengurangan atau pemindahan stok. Setiap pengajuan wajib alasan dan persetujuan kantor.", text: { side: "Ajukan penyesuaian stok di sini." } },
  { id: "gudang-perbandingan", match: /^\/gudang\/perbandingan$/, title: "Perbandingan berat", intro: "Membandingkan berat beli, masuk gudang, keluar gudang dan diterima pabrik per lot. Selisih di atas 2% ditandai merah.", text: { tabs: "Pilih Selisih > 2% untuk melihat lot yang perlu diperiksa." } },
  { id: "gudang-foto", match: /^\/gudang\/laporan-foto$/, title: "Laporan foto harian", intro: "Foto dari aplikasi petugas dan gudang, dikelompokkan per tahap dan per tanggal. Pakai tombol Sebelumnya dan Berikutnya untuk pindah hari." },

  { id: "produksi-detail", match: /^\/produksi\/[^/]+$/, title: "Batch produksi", intro: "Satu batch pembakaran arang: tempurung yang dipakai, biaya, hasil arang, rendemen dan HPP.", text: { side: "Data batch dan foto sebelum serta sesudah proses." } },
  { id: "produksi", match: /^\/produksi$/, title: "Produksi arang", intro: "Daftar batch produksi arang tempurung beserta rendemen dan HPP.", text: { side: "Mulai batch baru di sini. Bahan baku dan biaya diisi di halaman batch." } },

  { id: "pabrik", match: /^\/pabrik$/, title: "Pabrik & harga", intro: "Harga beli dari setiap pabrik, diurutkan dari hasil bersih per kg tertinggi setelah ongkir dan potongan.", text: { side: "Perbarui harga setelah dikonfirmasi pabrik, atau tambah pabrik baru." } },
  { id: "penjualan-piutang", match: /^\/penjualan\/piutang$/, title: "Tagihan & piutang", intro: "Tagihan ke pabrik yang belum dibayar, diurutkan dari jatuh tempo terdekat.", text: { side: "Total piutang per pabrik. Klik nama pabrik untuk menyaring daftar." } },
  { id: "penjualan-detail", match: /^\/penjualan\/[^/]+$/, title: "Detail penjualan", intro: "Satu pesanan pabrik dari awal sampai lunas: alokasi lot, barang keluar, penerimaan pabrik, tagihan dan pembayaran.", text: { collapse: "Buka bagian ini untuk mencatat barang keluar gudang.", side: "Data pabrik tujuan." } },
  { id: "penjualan", match: /^\/penjualan$/, title: "Penjualan & pengiriman", intro: "Pesanan ke pabrik dan progres pengirimannya.", text: { side: "Buat pesanan baru. Setelah itu alokasikan lot di halaman pesanan." } },

  { id: "kas-transfer", match: /^\/kas\/transfer$/, title: "Transfer & modal", intro: "Perpindahan uang antarkas, setoran modal dan penarikan pemilik. Transfer antarkas tidak dihitung sebagai biaya." },
  { id: "kas-pengeluaran", match: /^\/kas\/pengeluaran$/, title: "Pengeluaran", intro: "Biaya operasional seperti BBM, perbaikan, uang makan, listrik dan sewa.", text: { tabs: "Belum diperiksa berisi pengeluaran dari aplikasi petugas yang perlu dicek kantor.", table: "Tekan Valid bila nota sesuai, atau Tolak bila tidak sesuai." } },
  { id: "kas-gaji", match: /^\/kas\/gaji$/, title: "Gaji karyawan", intro: "Pembayaran gaji per bulan. Pakai tombol bulan di atas untuk pindah periode." },
  { id: "kas-bonus", match: /^\/kas\/bonus$/, title: "Bonus", intro: "Pembayaran bonus kepada karyawan atau petugas." },
  { id: "kas-rekon", match: /^\/kas\/rekonsiliasi$/, title: "Rekonsiliasi bank", intro: "Mencocokkan saldo rekening koran dengan saldo di sistem pada tanggal tertentu." },
  { id: "kas-detail", match: /^\/kas\/[^/]+$/, title: "Mutasi kas", intro: "Semua uang masuk dan keluar dari satu akun kas atau bank, dengan saldo berjalan." },
  { id: "kas", match: /^\/kas$/, title: "Kas & bank", intro: "Saldo setiap kas usaha, rekening bank dan kas yang dipegang petugas.", text: { table: "Klik nama akun untuk melihat mutasinya." } },

  { id: "jurnal", match: /^\/akuntansi\/jurnal$/, title: "Jurnal", intro: "Jurnal terbentuk otomatis dari transaksi yang disetujui. Jurnal manual dipakai untuk saldo awal dan koreksi.", text: { collapse: "Buka bagian ini untuk membuat jurnal manual. Total debit dan kredit harus seimbang." } },
  { id: "akun", match: /^\/akuntansi\/akun$/, title: "Bagan akun & saldo", intro: "Saldo setiap akun dari seluruh jurnal, dikelompokkan per jenis akun." },
  { id: "periode", match: /^\/akuntansi\/periode$/, title: "Tutup periode", intro: "Periode yang sudah ditutup tidak bisa diubah. Koreksi dicatat di periode berjalan." },

  { id: "laporan-detail", match: /^\/laporan\/[^/]+$/, title: "Isi laporan", intro: "Pilih periode, saring data, lalu unduh ke Excel atau cetak.", text: { tabs: "Pilihan cepat periode: hari ini, minggu ini, bulan ini atau tahun ini." } },
  { id: "laporan", match: /^\/laporan$/, title: "Laporan", intro: "Semua laporan dikelompokkan menjadi operasional, keuangan, serta akuntansi dan laba.", order: ["header", "list"], text: { list: "Klik salah satu kartu untuk membuka laporannya." } },

  { id: "pengguna", match: /^\/pengaturan\/pengguna$/, title: "Pengguna & hak akses", intro: "Akun karyawan, peran dan izin melihat data. Klik nama pengguna untuk mengubah datanya.", text: { side: "Buat akun baru. Pengguna login memakai email dan password ini di website dan aplikasi." } },
  { id: "master", match: /^\/pengaturan\/master$/, title: "Data master", intro: "Daftar produk, mutu, gudang, kendaraan dan kategori pengeluaran yang dipakai di seluruh sistem.", text: { tabs: "Pilih jenis data yang ingin diubah.", table: "Ubah langsung di baris, lalu tekan Simpan. Baris tambah baru ada di bagian bawah." } },
  { id: "aturan", match: /^\/pengaturan\/aturan$/, title: "Aturan sistem", intro: "Batas toleransi, tenggat dan pengingat yang dipakai di website dan aplikasi." },
  { id: "audit", match: /^\/pengaturan\/audit$/, title: "Jejak perubahan", intro: "Catatan setiap pembuatan, perubahan dan penghapusan transaksi penting, termasuk siapa dan kapan." },
  { id: "aplikasi", match: /^\/pengaturan\/aplikasi$/, title: "Aplikasi Android", intro: "Upload versi APK terbaru di sini. File langsung tersedia di halaman Unduh untuk karyawan." },
];

export function findTour(path: string) {
  return TOURS.find((t) => t.match.test(path)) ?? null;
}