-- Seed partners + products from master-data.ts SEED_*
-- Run after 20261030_master_rbac.sql

insert into public.partners (
  id, kind, name, legal_name, "group", area, postal_code, phone, email, address,
  contact_name, contact_phone, npwp, pkp, bank_name, bank_account, bank_holder,
  payment_method, payment_term_days, credit_limit, active, note
) values
  ('sup-01', 'supplier', 'Kelompok Tani Sri Rejeki', 'Kelompok Tani Sri Rejeki', 'Kelompok tani', 'Desa Ngawen', '57413', '0812-3400-1101', 'sri.rejeki@tani.id', 'Dusun Krajan RT 02/01', 'Pak Slamet', '0812-3400-1101', '', false, 'BRI', '0123-01-445566-53-2', 'Kelompok Tani Sri Rejeki', 'transfer', 7, 0, true, 'Mitra panen rutin musim kemarau'),
  ('sup-02', 'supplier', 'Pak Darmo', 'Pak Darmo', 'Petani', 'Desa Sukamaju', '', '0813-2211-4455', '', 'Jl. Sawah Barat No. 8', 'Pak Darmo', '', '', false, '', '', '', 'tunai', 7, 0, true, ''),
  ('sup-03', 'supplier', 'UD Tani Makmur', 'UD Tani Makmur', 'UD / CV', 'Kec. Karanganyar', '', '0272-441-220', 'admin@tanimakmur.id', 'Jl. Raya Karanganyar Km 3', 'Bu Rina', '0812-7788-9900', '10.0.0.1-412.000', true, 'BCA', '7788990011', 'UD Tani Makmur', 'transfer', 14, 0, true, 'Sering kirim GKG'),
  ('sup-04', 'supplier', 'Bu Suminah', 'Bu Suminah', 'Petani', 'Desa Tegalsari', '', '0857-9900-2211', '', 'Tegalsari RT 04', 'Bu Suminah', '', '', false, '', '', '', 'tunai', 0, 0, true, 'Prefer bayar tunai'),
  ('sup-05', 'supplier', 'Koperasi Tani Sejahtera', 'Koperasi Tani Sejahtera', 'Koperasi', 'Kec. Gondang', '', '0272-555-018', 'koperasi@sejahtera.id', 'Komplek Pasar Gondang', 'Pak Hadi', '', '10.0.1.3-412.000', true, 'Bank Jateng', '3-012-00456-1', 'Koperasi Tani Sejahtera', 'transfer', 7, 0, true, ''),
  ('cus-01', 'customer', 'Toko Beras Makmur', 'Toko Beras Makmur', 'Toko', 'Solo', '57131', '0271-712-330', 'order@berasmakmur.id', 'Jl. Slamet Riyadi No. 45', 'Mas Andi', '0812-5555-0101', '10.20.0.3-501.000', true, 'BRI', '0123-01-998877-53-2', 'Toko Beras Makmur', 'transfer', 7, 50000000, true, 'Order beras premium rutin'),
  ('cus-02', 'customer', 'UD Sumber Rejeki', 'UD Sumber Rejeki', 'Distributor', 'Klaten', '', '0272-330-112', 'ud.sumber@mail.id', 'Pasar Klaten Blok B-12', 'Bu Sari', '', '', false, '', '', '', 'campuran', 14, 75000000, true, ''),
  ('cus-03', 'customer', 'Pasar Induk Wonogiri', 'Pasar Induk Wonogiri', 'Pasar', 'Wonogiri', '', '0273-441-008', '', 'Komplek Pasar Induk', 'Pak Budi', '', '', false, '', '', '', 'tunai', 7, 25000000, true, 'Volume menir & medium'),
  ('cus-04', 'customer', 'Warung Bu Lastri', 'Warung Bu Lastri', 'Retail', 'Sragen', '', '0856-4411-2290', '', 'Jl. Raya Sragen–Solo Km 2', 'Bu Lastri', '', '', false, '', '', '', 'tunai', 0, 5000000, true, 'COD'),
  ('cus-05', 'customer', 'CV Pangan Sejahtera', 'CV Pangan Sejahtera', 'Institusi', 'Yogyakarta', '', '0274-551-900', 'procurement@pangansejahtera.id', 'Jl. Magelang Km 5', 'Ibu Maya', '0813-7000-2211', '192.168.0.2-542.000', true, 'Mandiri', '1370012345678', 'CV Pangan Sejahtera', 'transfer', 30, 200000000, true, 'Kontrak bulanan')
on conflict (id) do update set
  kind = excluded.kind,
  name = excluded.name,
  legal_name = excluded.legal_name,
  "group" = excluded."group",
  area = excluded.area,
  postal_code = excluded.postal_code,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  contact_name = excluded.contact_name,
  contact_phone = excluded.contact_phone,
  npwp = excluded.npwp,
  pkp = excluded.pkp,
  bank_name = excluded.bank_name,
  bank_account = excluded.bank_account,
  bank_holder = excluded.bank_holder,
  payment_method = excluded.payment_method,
  payment_term_days = excluded.payment_term_days,
  credit_limit = excluded.credit_limit,
  active = excluded.active,
  note = excluded.note,
  updated_at = now();

insert into public.products (
  id, sku, name, unit, category, barcode, default_price, cost_price, min_qty, taxable, active, note
) values
  ('prd-01', 'GBH-IR64', 'Gabah IR64', 'kg', 'gabah', '', 6700, 6500, 500, false, true, 'Masuk dari penerimaan GKP'),
  ('prd-02', 'GBH-CIHERANG', 'Gabah Ciherang', 'kg', 'gabah', '', 8200, 8000, 500, false, true, 'Biasanya GKG'),
  ('prd-03', 'BRS-PREM', 'Beras Premium 25kg', 'sak', 'beras', '8991002200011', 320000, 295000, 20, true, true, ''),
  ('prd-04', 'BRS-MED', 'Beras Medium', 'kg', 'beras', '8991002200028', 11500, 10200, 200, true, true, ''),
  ('prd-05', 'MNR-01', 'Menir', 'kg', 'sampingan', '', 4500, 3800, 100, false, true, ''),
  ('prd-06', 'DDK-01', 'Dedak', 'kg', 'sampingan', '', 3200, 2700, 100, false, true, ''),
  ('prd-07', 'SKM-01', 'Sekam', 'kg', 'sampingan', '', 800, 500, 200, false, true, '')
on conflict (id) do update set
  sku = excluded.sku,
  name = excluded.name,
  unit = excluded.unit,
  category = excluded.category,
  barcode = excluded.barcode,
  default_price = excluded.default_price,
  cost_price = excluded.cost_price,
  min_qty = excluded.min_qty,
  taxable = excluded.taxable,
  active = excluded.active,
  note = excluded.note,
  updated_at = now();
