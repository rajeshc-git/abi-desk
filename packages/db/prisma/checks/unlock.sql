-- Clears a stuck Prisma Migrate advisory lock.
--
-- Prisma serialises migrations on pg_advisory_lock(72707369). If a migrate run is
-- killed mid-flight (Ctrl-C, an aborted tool call), the holding session can survive
-- and every later migrate fails with P1002 "timed out trying to acquire a postgres
-- advisory lock".
--
-- This shows the holders, then terminates every non-superuser session on the database
-- so the lock is released. Safe in development; in production you would identify and
-- stop the specific deploy job instead.

\echo '=== sessions currently holding an advisory lock ==='
SELECT a.pid,
       a.usename,
       a.application_name,
       a.state,
       age(now(), a.backend_start) AS connected_for
FROM pg_locks l
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory';

\echo '=== all sessions on this database ==='
SELECT pid, usename, application_name, state
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

\echo '=== terminating them ==='
SELECT pg_terminate_backend(pid) AS terminated
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

\echo '=== advisory locks remaining (expect 0 rows) ==='
SELECT count(*) AS remaining_advisory_locks
FROM pg_locks
WHERE locktype = 'advisory';
