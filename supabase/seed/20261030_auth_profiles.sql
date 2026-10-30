-- Seed Auth users + public.profiles (password semua: demo123)
-- Idempotent: hapus email demo lalu insert ulang.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  demo record;
  uid uuid;
  pwd text := extensions.crypt('demo123', extensions.gen_salt('bf'));
begin
  for demo in
    select * from (values
      ('admin@egabah.local'::text, 'Admin E-Gabah'::text, 'admin'::public.user_role, 'Pemilik'::text, '0812-0000-0001'::text, 'Kantor Pusat'::text, 'Manajemen'::text),
      ('beli@egabah.local', 'Petugas Pembelian', 'pembelian', '', '0812-0000-0002', 'Mill Klaten', 'Pembelian'),
      ('produksi@egabah.local', 'Operator Produksi', 'produksi', '', '0812-0000-0003', 'Mill Klaten', 'Produksi'),
      ('gudang@egabah.local', 'Petugas Gudang', 'gudang', '', '0812-0000-0004', 'Mill Klaten', 'Gudang'),
      ('jual@egabah.local', 'Petugas Penjualan', 'penjualan', '', '0812-0000-0005', 'Mill Klaten', 'Penjualan'),
      ('kas@egabah.local', 'Petugas Keuangan', 'keuangan', '', '0812-0000-0006', 'Mill Klaten', 'Keuangan')
    ) as t(email, name, role, title, phone, branch, department)
  loop
    -- hapus user lama dengan email sama (cascade identities + profiles)
    delete from auth.users where lower(email) = lower(demo.email);

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      demo.email,
      pwd,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', demo.name, 'role', demo.role::text),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      uid,
      jsonb_build_object(
        'sub', uid::text,
        'email', demo.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      uid::text,
      now(),
      now(),
      now()
    );

    insert into public.profiles (
      id, email, name, role, title, phone, branch, department, active
    ) values (
      uid,
      demo.email,
      demo.name,
      demo.role,
      demo.title,
      demo.phone,
      demo.branch,
      demo.department,
      true
    )
    on conflict (id) do update set
      email = excluded.email,
      name = excluded.name,
      role = excluded.role,
      title = excluded.title,
      phone = excluded.phone,
      branch = excluded.branch,
      department = excluded.department,
      active = true,
      updated_at = now();
  end loop;
end $$;

select email, role, active from public.profiles order by email;
