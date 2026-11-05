-- Expand ops_docs to keuangan family + payroll + audit. Migrate remaining snapshots.

alter table public.ops_docs drop constraint if exists ops_docs_module_chk;
alter table public.ops_docs add constraint ops_docs_module_chk check (
  module in (
    'pembelian', 'penjualan', 'produksi',
    'keuangan', 'period', 'bank', 'tax', 'gl', 'payroll', 'audit'
  )
);

do $$
declare
  snap record;
  elem jsonb;
  doc_id text;
begin
  for snap in
    select module_key, payload
    from public.app_module_snapshots
    where module_key in ('keuangan', 'period', 'bank', 'tax', 'gl', 'payroll', 'audit')
  loop
    if snap.module_key = 'keuangan' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'cashEntries', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('keuangan','cash_entries',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'payables', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('keuangan','payables',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'receivables', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('keuangan','receivables',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'expenses', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('keuangan','expenses',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'period' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'locks', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('period','locks',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'unlockRequests', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('period','unlock_requests',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'bank' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'sessions', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('bank','sessions',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'lines', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('bank','lines',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'tax' then
      insert into public.ops_docs(module,collection,id,doc)
      values (
        'tax', 'settings', 'settings',
        coalesce(snap.payload->'settings', '{}'::jsonb) || jsonb_build_object('id','settings')
      )
      on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'docs', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('tax','docs',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'invoices', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('tax','invoices',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'gl' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'accounts', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('gl','accounts',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      insert into public.ops_docs(module,collection,id,doc)
      values (
        'gl', 'account_map', 'map',
        jsonb_build_object('id','map','value', coalesce(snap.payload->'accountMap', '{}'::jsonb))
      )
      on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'journals', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('gl','journals',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'failedPosts', '[]'::jsonb))
      loop
        doc_id := coalesce(elem->>'sourceKey', elem->>'id');
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('gl','failed_posts',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'payroll' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'runs', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('payroll','runs',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;

    elsif snap.module_key = 'audit' then
      for elem in select * from jsonb_array_elements(coalesce(snap.payload->'logs', '[]'::jsonb))
      loop
        doc_id := elem->>'id';
        if coalesce(doc_id, '') = '' then continue; end if;
        insert into public.ops_docs(module,collection,id,doc) values ('audit','logs',doc_id,elem)
        on conflict (module,collection,id) do update set doc=excluded.doc, updated_at=now();
      end loop;
    end if;
  end loop;

  delete from public.app_module_snapshots
  where module_key in ('keuangan', 'period', 'bank', 'tax', 'gl', 'payroll', 'audit');
end $$;
