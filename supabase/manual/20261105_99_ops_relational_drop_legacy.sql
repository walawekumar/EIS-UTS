-- MANUAL POST-CUTOVER ONLY.
-- Apply AFTER relational tables are verified (counts + smoke CRUD) and the app
-- no longer reads ops_docs / app_module_snapshots.
-- Do NOT run this in the same batch as a first-time relational create unless
-- copy/verify already succeeded. Safe to re-run (IF EXISTS).
--
-- Apply order (lexical):
--   01_master_rbac → 02_ops_snapshots → 03_persediaan → 04_ops_docs →
--   05_ops_docs_finance → 06_ops_relational → 07_period_unlock_role_rls →
--   99_ops_relational_drop_legacy (this file, last).

drop table if exists public.ops_docs cascade;
drop table if exists public.app_module_snapshots cascade;
