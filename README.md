# Sistem Kopra, Tempurung & Arang — Website

Website untuk pemilik, admin, keuangan dan gudang. Dibangun dengan Next.js 15 (App Router) dan Supabase. Database yang sama dipakai oleh aplikasi Android petugas lapangan dan gudang.

## Isi folder

```
supabase/migrations/     Skema database, trigger, alur kerja, view, RLS, data awal, storage, jadwal pengingat
supabase/functions/      Edge function send-push (notifikasi HP lewat FCM)
src/app/login            Halaman masuk
src/app/(app)/           Semua halaman setelah login
  dashboard              Ringkasan saldo, stok, pembelian, penjualan, laba, status petugas
  petani                 Data petani, peta, kunjungan
  pembelian              Pembelian, timbang, pembayaran, panjar, terima gudang
  modal                  Pengajuan modal, persetujuan, pencairan, LPJ, pengecualian
  gudang                 Stok & lot, mutasi, opname, penyesuaian, perbandingan berat, laporan foto
  produksi               Batch produksi arang, rendemen, HPP
  pabrik                 Data pabrik, harga terkini, perbandingan hasil bersih
  penjualan              Pesanan, alokasi lot, barang keluar, terima pabrik, retur, tagihan, piutang
  kas                    Kas & bank, transfer, pengeluaran, gaji, bonus, rekonsiliasi
  akuntansi              Jurnal, saldo akun, tutup periode
  laporan                Semua laporan + ekspor Excel/PDF
  pengaturan             Pengguna & hak akses, data master, aturan, jejak perubahan
src/components           Komponen tampilan (tabel, form, peta, foto, ekspor)
src/lib                  Supabase client, sesi & peran, format angka/tanggal
```

## Langkah pemasangan

1. Buat project baru di Supabase.
2. Di Dashboard Supabase > Database > Extensions, aktifkan `pg_cron`.
3. Buka SQL Editor, jalankan file di `supabase/migrations` berurutan dari `0001` sampai `0008`.
   Jika memakai Supabase CLI: `supabase link --project-ref <ref>` lalu `supabase db push`.
4. Salin `.env.example` menjadi `.env.local`, isi URL, anon key dan service role key dari Settings > API.
5. Install dan jalankan:
   ```
   npm install
   npm run dev
   ```
6. Buat akun pemilik pertama:
   - Supabase Dashboard > Authentication > Users > Add user (email + password, centang auto confirm).
   - Jalankan di SQL Editor (ganti emailnya):
     ```sql
     insert into user_roles(user_id, role)
     select id, 'owner' from auth.users where email = 'pemilik@contoh.com';
     ```
   - Login di website. Pengguna berikutnya dibuat dari menu Pengaturan > Pengguna & Hak Akses.
7. Isi data awal: Pengaturan > Data Master (gudang, kendaraan, mutu), Pabrik & Harga, lalu setoran modal awal di Kas > Transfer & Modal > Setoran modal pemilik.

## Notifikasi HP (opsional, untuk aplikasi Android)

1. Buat project Firebase, unduh service account JSON.
2. `supabase secrets set FCM_SERVICE_ACCOUNT='<isi json satu baris>'`
3. `supabase functions deploy send-push`
4. Dashboard > Database > Webhooks: tabel `public.notifications`, event `INSERT`, tipe Supabase Edge Functions, pilih `send-push`.

Aplikasi Android menyimpan token FCM ke tabel `device_tokens`.

## Deploy

Deploy ke Vercel: import repository, isi tiga variabel environment yang sama dengan `.env.local`.

## Peran dan akses

| Peran | Akses |
|---|---|
| Pemilik/Admin (`owner`) | Semua data, persetujuan modal, pengecualian, pengguna, tutup periode |
| Keuangan (`finance`) | Pencairan, pemeriksaan LPJ & bukti, kas/bank, pengeluaran, penjualan, laporan. Gaji dan laba sesuai izin |
| Petugas lapangan (`field`) | Data miliknya sendiri lewat aplikasi Android |
| Gudang/Produksi (`warehouse`) | Pembelian dalam perjalanan, terima barang, stok, opname, produksi, pengiriman |

Satu akun boleh memiliki beberapa peran. Izin "lihat harga jual", "lihat gaji" dan "lihat laba" diatur per pengguna. Pembatasan ini diterapkan di database (Row Level Security), bukan hanya di tampilan.

## Cara kerja utama

- **Penomoran otomatis**: PM (pengajuan modal), PB (pembelian), PJ (panjar), BM (barang masuk), BK (barang keluar), LOT, PRD, SO, INV, KK, LPJ, TRF, GJ, BNS, JU. Format `PB-2610-0001`.
- **Kunci pengajuan modal**: dicek di database (`can_request_capital`). Pengajuan ditolak jika penugasan sebelumnya belum selesai, ada barang belum dikonfirmasi gudang melewati batas hari, atau sisa kas belum disetor. Pemilik dapat memberi pengecualian dengan alasan, batas nominal dan tenggat.
- **Saldo kas petugas** = saldo awal + dana diterima − pembayaran/pengeluaran − setoran kembali. Transfer antarkas tidak dihitung sebagai biaya.
- **Panjar** dicatat sebagai piutang ke petani (akun 1202). Saat dipotong di pembelian, utang ke petani berkurang tanpa mencatat biaya dua kali.
- **Lot** dibuat otomatis saat barang diterima gudang. HPP lot = nilai pembelian ÷ berat diterima. Hasil produksi membuat lot arang dengan HPP = biaya batch ÷ arang layak jual.
- **Stok dipesan**: lot yang dialokasikan ke pesanan penjualan tidak dihitung sebagai stok bebas.
- **Jurnal otomatis** dibuat dari setiap transaksi (pembelian, pembayaran, panjar, pengeluaran, transfer, produksi, pengiriman, tagihan, pembayaran pabrik, gaji, bonus, opname, penyesuaian). Koreksi transaksi memperbarui jurnalnya. Periode yang ditutup tidak bisa diubah.
- **Pengingat otomatis** berjalan setiap hari pukul 07.00 WIB lewat `pg_cron` (`generate_reminders`).
- **Jejak perubahan** tersimpan di tabel `audit_logs` untuk transaksi penting.

## Akun buku besar

1101 Kas Usaha · 1102 Bank · 1103 Kas Petugas · 1201 Piutang Pabrik · 1202 Panjar Petani · 1301 Persediaan · 1302 Barang Dalam Proses · 1303 Barang Dalam Pengiriman · 2101 Utang Petani · 2102 Utang Lain · 3101 Modal Pemilik · 4101 Penjualan · 5101 HPP · 5102 Susut & Selisih Persediaan · 61xx Biaya operasional

## Catatan untuk aplikasi Android

Aplikasi memakai project Supabase yang sama.

- **ID dibuat di HP** (UUID v4) agar data bisa disimpan offline lalu dikirim saat online. Isi juga kolom `client_created_at` dengan waktu di HP. Nomor dokumen dibuat server saat data masuk.
- **Urutan sinkron pembelian**: `purchases` → `purchase_weighings` → `advance_allocations` → `purchase_payments` → foto ke storage → `attachments`.
- **Foto**: bucket `attachments`, path `<user_id>/<ref_type>/<ref_id>/<uuid>.jpg`. Isi `taken_at`, `lat`, `lng`, `gps_accuracy`, `source` (`camera`/`gallery`). Waktu diterima server dicatat otomatis.
- **Jenis foto (`kind`)**: pembelian `goods`, `scale`, `receipt`; masuk gudang `arrival`, `scale`, `storage`; keluar `scale`, `load`, `delivery_note`; diterima pabrik `factory_scale`, `factory_receipt`; produksi `before`, `after`; pengeluaran & panjar `receipt`.
- **RPC yang dipakai aplikasi**: `can_request_capital`, `assignment_summary`, `assignment_missing_proofs`, `confirm_assignment_received`, `submit_lpj`, `field_account_of`.
- **Gudang** cukup insert ke `goods_receipts`, `goods_dispatches` + `dispatch_lots`, `factory_receipts`, `production_batches` + `production_inputs`, `stock_opnames` + `stock_opname_items`, `stock_adjustments`. Stok dan jurnal diproses oleh trigger.
- Pengajuan modal (`assignments`) harus online karena kunci dicek saat data masuk.
