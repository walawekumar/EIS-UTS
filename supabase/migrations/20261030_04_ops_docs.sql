-- Document-per-row for pembelian / penjualan / produksi.
-- Depends on auth_can_write_module() from 20261030_02_ops_snapshots.sql.

create table if not exists public.ops_docs (
  module text not null,
  collection text not null,
  id text not null,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (module, collection, id),
  constraint ops_docs_module_chk check (
    module in ('pembelian', 'penjualan', 'produksi')
  )
);

create index if not exists ops_docs_module_collection_idx
  on public.ops_docs (module, collection);

alter table public.ops_docs enable row level security;

drop policy if exists ops_docs_select on public.ops_docs;
create policy ops_docs_select on public.ops_docs
  for select to authenticated
  using (true);

drop policy if exists ops_docs_insert on public.ops_docs;
create policy ops_docs_insert on public.ops_docs
  for insert to authenticated
  with check (public.auth_can_write_module(module));

drop policy if exists ops_docs_update on public.ops_docs;
create policy ops_docs_update on public.ops_docs
  for update to authenticated
  using (public.auth_can_write_module(module))
  with check (public.auth_can_write_module(module));

drop policy if exists ops_docs_delete on public.ops_docs;
create policy ops_docs_delete on public.ops_docs
  for delete to authenticated
  using (public.auth_can_write_module(module));

-- Migrate from singleton snapshots → one row per document (idempotent).
do $$
declare
  snap record;
  elem jsonb;
  doc_id text;
begin
  for snap in
    select module_key, payload
    from public.app_module_snapshots
    where module_key in ('pembelian', 'penjualan', 'produksi')
  loop
    if snap.module_key = 'pembelian' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'purchases', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('pembelian', 'purchases', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'returns', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('pembelian', 'returns', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'lotQc', '[]'::jsonb))
      loop
        doc_id := coalesce(elem->>'lotId', elem->>'id');
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('pembelian', 'lot_qc', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
    elsif snap.module_key = 'penjualan' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'orders', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('penjualan', 'orders', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'returns', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('penjualan', 'returns', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
    elsif snap.module_key = 'produksi' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'batches', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('produksi', 'batches', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'packRuns', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('produksi', 'pack_runs', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'lotCosts', '[]'::jsonb))
      loop
        doc_id := coalesce(elem->>'lotId', elem->>'id');
        if doc_id is null or doc_id = '' then continue; end if;
        insert into public.ops_docs (module, collection, id, doc)
        values ('produksi', 'lot_costs', doc_id, elem)
        on conflict (module, collection, id) do update
          set doc = excluded.doc, updated_at = now();
      end loop;
    end if;
  end loop;

  delete from public.app_module_snapshots
  where module_key in ('pembelian', 'penjualan', 'produksi');
end $$;
