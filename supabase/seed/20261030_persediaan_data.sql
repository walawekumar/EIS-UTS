-- Seed Persediaan (ids match persediaan-data.ts). Run after migration.

insert into public.stock_balances (id, sku, name, category, location, unit, qty, min_qty, updated_at_label)
values
  ('s1', 'GBH-IR64', 'Gabah IR64', 'gabah', 'Silo 1', 'kg', 12480, 5000, '29 Okt 2026'),
  ('s2', 'GBH-CIHERANG', 'Gabah Ciherang', 'gabah', 'Gudang A', 'kg', 4200, 4500, '28 Okt 2026'),
  ('s3', 'BRS-PREM', 'Beras Premium 25kg', 'beras', 'Gudang A', 'sak', 860, 200, '29 Okt 2026'),
  ('s4', 'BRS-MED', 'Beras Medium', 'beras', 'Gudang B', 'kg', 3150, 2000, '27 Okt 2026'),
  ('s5', 'MNR-01', 'Menir', 'sampingan', 'Gudang B', 'kg', 780, 500, '26 Okt 2026'),
  ('s6', 'DDK-01', 'Dedak', 'sampingan', 'Lantai Produksi', 'kg', 420, 600, '29 Okt 2026'),
  ('s7', 'SKM-01', 'Sekam', 'sampingan', 'Lantai Produksi', 'kg', 1050, 400, '25 Okt 2026'),
  ('s8', 'BRS-PREM', 'Beras Premium 25kg', 'beras', 'Gudang B', 'sak', 120, 150, '28 Okt 2026')
on conflict (id) do update set
  sku = excluded.sku,
  name = excluded.name,
  category = excluded.category,
  location = excluded.location,
  unit = excluded.unit,
  qty = excluded.qty,
  min_qty = excluded.min_qty,
  updated_at_label = excluded.updated_at_label,
  updated_at = now();

insert into public.stock_movements (
  id, date_label, reference, type, sku, product_name,
  from_location, to_location, qty, unit, note, actor, receipt_name
)
values
  ('m1', '29 Okt 2026', 'MUT-2210', 'in', 'GBH-IR64', 'Gabah IR64', '—', 'Silo 1', 2500, 'kg', 'Penerimaan RCV-0241', 'Budi Gudang', ''),
  ('m2', '29 Okt 2026', 'MUT-2209', 'out', 'GBH-IR64', 'Gabah IR64', 'Silo 1', '—', 1800, 'kg', 'Ke batch BAT-0190', 'Andi Ops', ''),
  ('m3', '28 Okt 2026', 'MUT-2204', 'transfer', 'BRS-PREM', 'Beras Premium 25kg', 'Gudang A', 'Gudang B', 40, 'sak', 'Siapkan order DO-0881', 'Budi Gudang', ''),
  ('m4', '27 Okt 2026', 'MUT-2198', 'out', 'BRS-MED', 'Beras Medium', 'Gudang B', '—', 500, 'kg', 'Pengiriman DO-0876', 'Rina Sales', ''),
  ('m5', '26 Okt 2026', 'MUT-2191', 'in', 'MNR-01', 'Menir', '—', 'Gudang B', 180, 'kg', 'Output produksi BAT-0188', 'Andi Ops', '')
on conflict (id) do update set
  date_label = excluded.date_label,
  reference = excluded.reference,
  type = excluded.type,
  sku = excluded.sku,
  product_name = excluded.product_name,
  from_location = excluded.from_location,
  to_location = excluded.to_location,
  qty = excluded.qty,
  unit = excluded.unit,
  note = excluded.note,
  actor = excluded.actor,
  receipt_name = excluded.receipt_name,
  updated_at = now();

insert into public.stock_corrections (
  id, date_label, reference, sku, product_name, location,
  before_qty, after_qty, unit, reason, status, actor, receipt_name
)
values
  ('k1', '28 Okt 2026', 'ADJ-0077', 'DDK-01', 'Dedak', 'Lantai Produksi', 480, 420, 'kg', 'Susut timbang ulang', 'posted', 'Budi Gudang', ''),
  ('k2', '25 Okt 2026', 'ADJ-0072', 'GBH-CIHERANG', 'Gabah Ciherang', 'Gudang A', 4050, 4200, 'kg', 'Selisih penerimaan tertunda', 'posted', 'Admin', ''),
  ('k3', '22 Okt 2026', 'ADJ-0068', 'SKM-01', 'Sekam', 'Lantai Produksi', 1100, 1050, 'kg', 'Koreksi salah input (dibatalkan)', 'void', 'Admin', '')
on conflict (id) do update set
  date_label = excluded.date_label,
  reference = excluded.reference,
  sku = excluded.sku,
  product_name = excluded.product_name,
  location = excluded.location,
  before_qty = excluded.before_qty,
  after_qty = excluded.after_qty,
  unit = excluded.unit,
  reason = excluded.reason,
  status = excluded.status,
  actor = excluded.actor,
  receipt_name = excluded.receipt_name,
  updated_at = now();
