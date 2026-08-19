#!/usr/bin/env node
/**
 * Regenerates part 02 of the baseline: the schema DDL.
 *
 *   pnpm --filter @abi-desk/db run baseline:generate
 *
 * Wraps `prisma migrate diff --from-empty` and prepends a DO-NOT-EDIT banner.
 *
 * The wrapper exists because the filename cannot carry the warning: all three parts share
 * one `NN-schema.sql` convention, so nothing in `02-schema.sql` distinguishes it from its
 * hand-written siblings. Putting the banner inside the file puts it where a person about to
 * edit it is actually looking.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const OUT = join(here, '02-schema.sql');

const BANNER = `-- =========================================================================
-- BASELINE PART 2 of 3 - schema (02-schema.sql)
--
-- GENERATED FILE. DO NOT EDIT. NOT COMMITTED.
--
-- Every table, enum, index and foreign key, derived from the Prisma schema by:
--   prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema
--
-- Edit prisma/schema/*.prisma instead, then run:
--   pnpm --filter @abi-desk/db run baseline:rebuild
--
-- This file is gitignored on purpose. Committing it would create a second source of
-- truth for DDL that the Prisma schema already defines, and the copy is always the one
-- that drifts. The assembled migration.sql is the committed artifact.
-- =========================================================================

`;

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    './prisma/schema',
    '--script',
    '-o',
    OUT,
  ],
  {
    cwd: packageRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (result.status !== 0) {
  console.error('prisma migrate diff failed:');
  console.error(`${result.stdout ?? ''}${result.stderr ?? ''}`);
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error(`prisma migrate diff reported success but wrote no file at ${OUT}.`);
  process.exit(1);
}

// Strip any BOM: psql treats it as part of the first statement.
const ddl = readFileSync(OUT, 'utf8')
  .replace(/^\uFEFF/, '')
  .trim();

if (!ddl.includes('CREATE TABLE')) {
  console.error('Generated SQL contains no CREATE TABLE - the diff produced nothing usable.');
  process.exit(1);
}

writeFileSync(OUT, `${BANNER}${ddl}\n`, 'utf8');

const tables = (ddl.match(/^CREATE TABLE/gm) ?? []).length;
const types = (ddl.match(/^CREATE TYPE/gm) ?? []).length;
console.log(`Part 02 generated: ${OUT}`);
console.log(`  ${tables} tables, ${types} enum types`);
