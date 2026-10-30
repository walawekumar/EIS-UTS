-- Task 9: drop legacy document stores after relational cutover.
-- Deferred from Task 3. Safe to re-run.

drop table if exists public.ops_docs cascade;
drop table if exists public.app_module_snapshots cascade;
