-- =====================================================================
-- DATA AWAL
-- =====================================================================
insert into coa_accounts(code, name, type, normal, cash_flow_group) values
  ('1101','Kas Usaha','asset','debit',null),
  ('1102','Bank','asset','debit',null),
  ('1103','Kas Petugas Lapangan','asset','debit',null),
  ('1201','Piutang Usaha (Pabrik)','asset','debit','operating'),
  ('1202','Panjar Petani','asset','debit','operating'),
  ('1301','Persediaan Barang','asset','debit','operating'),
  ('1302','Barang Dalam Proses Produksi','asset','debit','operating'),
  ('1303','Barang Dalam Pengiriman','asset','debit','operating'),
  ('1501','Kendaraan & Peralatan','asset','debit','investing'),
  ('2101','Utang Pemasok/Petani','liability','credit','operating'),
  ('2102','Utang Lain-lain','liability','credit','operating'),
  ('3101','Modal Pemilik','equity','credit','financing'),
  ('3201','Laba Ditahan','equity','credit','financing'),
  ('4101','Penjualan','revenue','credit','operating'),
  ('4201','Pendapatan Lain-lain','other_income','credit','operating'),
  ('5101','Harga Pokok Penjualan','cogs','debit','operating'),
  ('5102','Susut & Selisih Persediaan','cogs','debit','operating'),
  ('6101','Biaya Gaji','expense','debit','operating'),
  ('6102','Biaya Bonus','expense','debit','operating'),
  ('6103','Biaya BBM Kendaraan','expense','debit','operating'),
  ('6104','Biaya Perbaikan & Servis','expense','debit','operating'),
  ('6105','Biaya Uang Makan','expense','debit','operating'),
  ('6106','Biaya Angkut & Bongkar Muat','expense','debit','operating'),
  ('6107','Biaya Listrik, Sewa & Pulsa','expense','debit','operating'),
  ('6108','Biaya Ongkos Kirim Penjualan','expense','debit','operating'),
  ('6199','Biaya Operasional Lainnya','expense','debit','operating'),
  ('6201','Selisih Kas','expense','debit','operating');

insert into expense_categories(code, name, coa_code) values
  ('BBM','BBM / Minyak Kendaraan','6103'),
  ('SERVIS','Perbaikan & Servis','6104'),
  ('MAKAN','Uang Makan','6105'),
  ('ANGKUT','Angkut & Bongkar Muat','6106'),
  ('LISTRIK','Listrik','6107'),
  ('SEWA','Sewa','6107'),
  ('PULSA','Pulsa & Internet','6107'),
  ('ONGKIR','Ongkos Kirim ke Pabrik','6108'),
  ('LAIN','Operasional Lainnya','6199');

insert into products(code, name, min_stock_kg) values
  ('KOPRA','Kopra', 0),
  ('TEMPURUNG','Tempurung', 0),
  ('ARANG','Arang Tempurung', 0);

insert into quality_grades(product_id, name)
select p.id, g from products p, unnest(array['Grade A','Grade B','Grade C']) g;

insert into warehouses(name, address) values ('Gudang Utama', null);

insert into cash_accounts(name, type, coa_code) values
  ('Kas Usaha', 'business', '1101'),
  ('Rekening Bank Utama', 'bank', '1102');

insert into settings(key, value) values
  ('company_name', '"Usaha Kopra & Arang"'),
  ('weight_tolerance_pct', '2'),
  ('transit_days', '3'),
  ('advance_open_days', '30'),
  ('lpj_default_days', '7'),
  ('allow_gallery_upload', 'true'),
  ('price_valid_hours', '24');
