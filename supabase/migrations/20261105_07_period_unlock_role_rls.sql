-- Period unlock: no client UPDATE on unlock requests; active→false only via admin RPC.
-- Depends on: profiles, period_unlock_requests, period_locks, auth_can_write_module.

-- ── Client must not forge approvals / status ──────────────────────────────
drop policy if exists period_unlock_requests_update on public.period_unlock_requests;

-- ── Block active→false unless session flag set by SECURITY DEFINER RPC ────
create or replace function public.enforce_period_lock_unlock_rpc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.active is true and new.active is false then
    if coalesce(current_setting('app.allow_period_unlock', true), '') is distinct from 'on' then
      raise exception 'period unlock requires approve_period_unlock_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_period_locks_unlock_rpc on public.period_locks;
create trigger trg_period_locks_unlock_rpc
  before update on public.period_locks
  for each row
  execute function public.enforce_period_lock_unlock_rpc();

-- ── Role approve (impact roles only; role taken from profiles) ────────────
create or replace function public.approve_period_unlock_role(
  p_request_id text,
  p_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_req public.period_unlock_requests%rowtype;
  v_required jsonb;
  v_approvals jsonb;
  v_stamp jsonb;
  v_has boolean := false;
  r text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role is null then
    raise exception 'unauthorized';
  end if;
  if v_role = 'admin' then
    raise exception 'use admin final approval';
  end if;

  select * into v_req
  from public.period_unlock_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  v_required := coalesce(v_req.required_roles, '[]'::jsonb);
  for r in select jsonb_array_elements_text(v_required)
  loop
    if r = v_role then
      v_has := true;
      exit;
    end if;
  end loop;

  if not v_has then
    raise exception 'role not required';
  end if;

  v_approvals := coalesce(v_req.approvals, '[]'::jsonb);
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_approvals
  from jsonb_array_elements(v_approvals) elem
  where elem->>'role' is distinct from v_role;

  v_stamp := jsonb_build_object(
    'role', v_role,
    'by', coalesce(nullif(trim(p_by), ''), v_role),
    'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
  v_approvals := v_approvals || jsonb_build_array(v_stamp);

  update public.period_unlock_requests
  set approvals = v_approvals,
      updated_at = now()
  where id = p_request_id;

  return v_approvals;
end;
$$;

revoke all on function public.approve_period_unlock_role(text, text) from public;
grant execute on function public.approve_period_unlock_role(text, text) to authenticated;

-- ── Admin final unlock ────────────────────────────────────────────────────
create or replace function public.approve_period_unlock_admin(
  p_request_id text,
  p_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_req public.period_unlock_requests%rowtype;
  v_required jsonb;
  v_approvals jsonb;
  v_stamp jsonb;
  v_history jsonb;
  r text;
  found_role boolean;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role is distinct from 'admin' then
    raise exception 'admin only';
  end if;

  select * into v_req
  from public.period_unlock_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  v_required := coalesce(v_req.required_roles, '[]'::jsonb);
  v_approvals := coalesce(v_req.approvals, '[]'::jsonb);

  for r in select jsonb_array_elements_text(v_required)
  loop
    found_role := false;
    if exists (
      select 1
      from jsonb_array_elements(v_approvals) elem
      where elem->>'role' = r
    ) then
      found_role := true;
    end if;
    if not found_role then
      raise exception 'missing role approval: %', r;
    end if;
  end loop;

  v_stamp := jsonb_build_object(
    'role', 'admin',
    'by', coalesce(nullif(trim(p_by), ''), 'admin'),
    'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  update public.period_unlock_requests
  set status = 'approved',
      admin_approval = v_stamp,
      updated_at = now()
  where id = p_request_id;

  select coalesce(unlock_history, '[]'::jsonb) into v_history
  from public.period_locks
  where id = v_req.period_lock_id
  for update;

  v_history := coalesce(v_history, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'at', v_stamp->>'at',
      'by', v_stamp->>'by',
      'reason', v_req.reason,
      'requestId', v_req.id
    )
  );

  perform set_config('app.allow_period_unlock', 'on', true);

  update public.period_locks
  set active = false,
      pending_unlock_request_id = null,
      unlock_history = v_history,
      updated_at = now()
  where id = v_req.period_lock_id;
end;
$$;

revoke all on function public.approve_period_unlock_admin(text, text) from public;
grant execute on function public.approve_period_unlock_admin(text, text) to authenticated;

-- ── Reject pending unlock ─────────────────────────────────────────────────
create or replace function public.reject_period_unlock(
  p_request_id text,
  p_by text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_req public.period_unlock_requests%rowtype;
  v_reason text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.id = auth.uid() and p.active = true;

  if v_role is null then
    raise exception 'unauthorized';
  end if;
  if v_role is distinct from 'admin' and v_role is distinct from 'keuangan' then
    raise exception 'admin or keuangan only';
  end if;

  v_reason := nullif(trim(p_reason), '');
  if v_reason is null then
    raise exception 'reason required';
  end if;

  select * into v_req
  from public.period_unlock_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  update public.period_unlock_requests
  set status = 'rejected',
      rejected_by = coalesce(nullif(trim(p_by), ''), v_role),
      reject_reason = v_reason,
      updated_at = now()
  where id = p_request_id;

  update public.period_locks
  set pending_unlock_request_id = null,
      updated_at = now()
  where id = v_req.period_lock_id
    and pending_unlock_request_id = p_request_id;
end;
$$;

revoke all on function public.reject_period_unlock(text, text, text) from public;
grant execute on function public.reject_period_unlock(text, text, text) to authenticated;
