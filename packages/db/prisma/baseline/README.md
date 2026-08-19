# Baseline migration sources

The single migration at `../schema/migrations/00000000000000_baseline/migration.sql`
(~2,500 lines) is **assembled** by concatenating the three parts in this folder, in numeric
order. Do not edit the assembled file — it is overwritten on every build.

```
01-schema.sql  ─┐
02-schema.sql  ─┼──►  build.mjs  ──►  ../schema/migrations/00000000000000_baseline/migration.sql
03-schema.sql  ─┘
```

| Part | File            |  Lines | Authored by           | Committed           |
| ---- | --------------- | -----: | --------------------- | ------------------- |
| 1    | `01-schema.sql` |   ~130 | hand                  | yes                 |
| 2    | `02-schema.sql` | ~1,950 | `prisma migrate diff` | **no** (gitignored) |
| 3    | `03-schema.sql` |   ~410 | hand                  | yes                 |

All three share one `NN-schema.sql` name, so the filename encodes ordering and nothing else.
Each file therefore opens with a `BASELINE PART N of 3` header naming what it contains — that
header is the content signal, since the filenames deliberately are not.

All three are required. The build refuses to emit a migration if part 2 is missing or
contains no `CREATE TABLE`, so the assembled file cannot silently lose the schema.

**Part 2 is not in version control**, and its absence on a fresh clone is expected — run
`baseline:rebuild`. It is derived mechanically from the Prisma schema; committing it would
create a second source of truth for DDL the schema already defines, and the copy is always
the one that drifts. The assembled `migration.sql` _is_ committed, because that is the
artifact PostgreSQL executes.

## What each part does, and why the order matters

**Part 1 — prerequisites.** Extensions, the `app` helper schema, the two functions every RLS
policy calls, and the runtime role's privileges.

`ALTER DEFAULT PRIVILEGES` has to run _before_ the tables exist, because it only applies to
objects created after it. That single fact dictates the three-part structure — grants cannot
simply be appended at the end. This part also raises an exception if the `abidesk_app` role
is missing, turning a confusing cascade of permission errors later into one clear message at
the start.

**Part 2 — schema.** Every table, enum, index and foreign key, generated from the Prisma
schema so the two cannot disagree.

**Part 3 — enforcement.** The guarantees Prisma has no syntax for:

- Row Level Security policies, applied by iterating the catalogue for tables carrying a
  `tenantId` column rather than from a hand-written list. A hardcoded list is one omission
  away from an unprotected table, and that omission is invisible — the table behaves
  correctly in every test while leaking across tenants.
- Partial unique indexes. PostgreSQL treats NULLs as distinct, so a plain composite unique
  over a nullable column does not actually enforce uniqueness.
- Append-only enforcement on `audit_log` and `ticket_event`, by trigger.
- The `tsvector` search trigger and the gap-free ticket-number function.
- A **self-check that aborts the migration** if any tenant-scoped table lacks its policy, so
  a deployment cannot come up silently unprotected.

## Rebuilding and verifying

```bash
pnpm --filter @abi-desk/db run baseline:rebuild   # regenerate part 2, then reassemble
pnpm --filter @abi-desk/db run baseline:verify    # prove it on a scratch database
```

`baseline:verify` creates a throwaway database, applies the baseline through the real
production path (`prisma migrate deploy`, not raw `psql`), runs both check scripts against
the result, and drops it — including on failure, so a leftover database cannot make the next
run fail for an unrelated reason. It asserts the migration count is exactly one, so an
accidental un-squash fails the check rather than passing quietly.

### The three checks, and why one is not enough

| Check                          | Answers                                         | Blind to                          |
| ------------------------------ | ----------------------------------------------- | --------------------------------- |
| `run drift`                    | do tables/columns match the Prisma schema?      | everything hand-written in part 3 |
| `checks/deployment-verify.sql` | is the deployed database in the expected state? | whether a _feature_ still works   |
| `checks/feature-coverage.sql`  | do every shipped feature's objects still exist? | data correctness                  |

The middle column is the point. `prisma migrate diff --exit-code` compares the Prisma
_datamodel_ to the database, so it is blind to every object in part 3 — RLS policies,
triggers, functions, partial unique indexes, CHECK constraints. Those are precisely the
objects that enforce correctness rather than store data, and precisely the ones a squash
could silently lose. `feature-coverage.sql` closes that gap by walking feature by feature and
asserting the objects that feature's code calls, so a failure names the thing that would
break rather than an anonymous missing index.

`checks/negative-test-rls-guard.sql` disables RLS on a table inside a rolled-back transaction
to confirm the guard actually fires. A verification script that cannot fail is worse than
none, because it manufactures confidence.

## Why one migration instead of six

The six incremental migrations produced during initial development contained pure churn: a
fresh database would have created the Knowledge Base, AI-routing and issue-tracker tables
along with their triggers and indexes, only to drop them again in the final step.
Functionally correct, wasteful, and fragile if anyone reordered it.

Squashing before first release is standard practice — Prisma calls it baselining, Rails and
Django have the same operation — and it is safe here precisely because no deployed data
exists to preserve. After the first production deploy, this folder freezes and all further
changes go through ordinary incremental migrations.

## Deploying to managed PostgreSQL

The compose stack creates the `abidesk_owner` and `abidesk_app` roles via
`docker/postgres/init/`. Managed providers (RDS, Cloud SQL, Neon) do not run those init
scripts, so run `docker/postgres/init/managed-setup.sql` once as the provider's admin user
before the first `migrate deploy`.
