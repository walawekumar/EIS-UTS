-- Pengaturan aplikasi (org + per pengguna) dan pembuatan akun cabang oleh admin.
-- Depends on: 20261030_01_master_rbac (profiles, auth_is_admin, user_role).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_settings (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (
    id = 'org'
    or id = 'user:' || auth.uid()::text
    or public.auth_is_admin()
  );

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (
    (id = 'org' and public.auth_is_admin())
    or id = 'user:' || auth.uid()::text
    or (public.auth_is_admin() and id like 'user:%')
  )
  with check (
    (id = 'org' and public.auth_is_admin())
    or id = 'user:' || auth.uid()::text
    or (public.auth_is_admin() and id like 'user:%')
  );

create or replace function public.admin_create_branch_user(
  p_email text,
  p_password text,
  p_name text,
  p_role public.user_role,
  p_title text,
  p_phone text,
  p_branch text,
  p_department text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
begin
  if not public.auth_is_admin() then
    raise exception 'Hanya admin yang dapat membuat akun';
  end if;
  if clean_email = '' or position('@' in clean_email) = 0 then
    raise exception 'Email tidak valid';
  end if;
  if length(trim(p_password)) < 8 then
    raise exception 'Kata sandi minimal 8 karakter';
  end if;
  if length(trim(p_name)) = 0 then
    raise exception 'Nama wajib diisi';
  end if;
  if length(trim(p_branch)) = 0 then
    raise exception 'Cabang wajib diisi';
  end if;
  if exists (select 1 from auth.users where lower(email) = clean_email) then
    raise exception 'Email sudah terpakai';
  end if;

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
    clean_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', trim(p_name), 'role', p_role::text),
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
      'email', clean_email,
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
    clean_email,
    trim(p_name),
    p_role,
    coalesce(nullif(trim(p_title), ''), p_role::text),
    coalesce(trim(p_phone), ''),
    trim(p_branch),
    coalesce(nullif(trim(p_department), ''), p_role::text),
    true
  );

  return uid;
end;
$$;

revoke all on function public.admin_create_branch_user(
  text, text, text, public.user_role, text, text, text, text
) from public;
grant execute on function public.admin_create_branch_user(
  text, text, text, public.user_role, text, text, text, text
) to authenticated;
