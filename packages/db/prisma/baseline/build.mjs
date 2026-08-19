#!/usr/bin/env node
/**
 * Assembles the single baseline migration from three sources, concatenated in order:
 *
 *   01-schema.sql   hand-written  extensions, app schema, RLS helper functions, grants
 *   02-schema.sql   generated     CREATE TYPE / TABLE / INDEX / FOREIGN KEY
 *   03-schema.sql   hand-written  RLS policies, partial uniques, triggers, self-check
 *
 * One `NN-schema.sql` convention across all three, so ordering is the only thing the
 * filename encodes. Each file opens with a `BASELINE PART N of 3` header naming what it
 * contains, since the filenames deliberately do not.
 *
 * All three are required. The build refuses to emit a migration if part 02 is missing or
 * contains no CREATE TABLE, so the assembled file cannot silently lose the schema.
 *
 * Why a build step rather than one hand-maintained file: the middle section is 1900
 * lines of generated DDL that must track the Prisma schema exactly. Hand-editing it
 * guarantees drift. Generating it and bolting on the parts Prisma cannot express keeps
 * both halves authoritative.
 *
 * Usage:
 *   pnpm --filter @abi-desk/db run baseline:build
 *
 * The result is verified by `baseline:verify`, which resets a scratch database, applies
 * the migration and diffs the outcome against the schema.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');

// Part 02 lives beside its siblings so the folder reads 01 -> 02 -> 03 rather than
// leaving a gap that looks like a missing file. It is regenerated from the Prisma
// schema on every build and is gitignored, because the assembled migration.sql is the
// artifact that actually ships.
const GENERATED = join(here, '02-schema.sql');
const OUT_DIR = join(packageRoot, 'prisma', 'schema', 'migrations', '00000000000000_baseline');
const OUT_FILE = join(OUT_DIR, 'migration.sql');

function read(path) {
  if (!existsSync(path)) {
    console.error(`Missing input: ${path}`);
    console.error('Run `pnpm --filter @abi-desk/db run baseline:generate` first.');
    process.exit(1);
  }
  return readFileSync(path, 'utf8');
}

const partOne = read(join(here, '01-schema.sql'));
const partThree = read(join(here, '03-schema.sql'));
let generated = read(GENERATED);

// `prisma migrate diff` emits a leading comment block; keep it, it documents provenance.
// What must be stripped is any BOM, which psql treats as part of the first statement.
generated = generated.replace(/^\uFEFF/, '').trim();

if (!generated.includes('CREATE TABLE')) {
  console.error('Generated SQL contains no CREATE TABLE - the diff step produced nothing usable.');
  process.exit(1);
}

// A generated section that still mentions a removed feature means the schema and the
// generated DDL are out of step, which would silently reintroduce dropped tables.
for (const forbidden of [
  'kb_article',
  'kb_category',
  'integration_connection',
  'ticket_ai_suggestion',
]) {
  if (generated.includes(forbidden)) {
    console.error(`Generated SQL still references removed table "${forbidden}".`);
    console.error('Re-run baseline:generate against the current schema.');
    process.exit(1);
  }
}

const banner = `-- =========================================================================
-- ABI Desk - baseline migration
--
-- ASSEMBLED FILE. DO NOT EDIT.
--
-- Built by packages/db/prisma/baseline/build.mjs by concatenating, in order:
--   prisma/baseline/01-schema.sql  (hand-written: extensions, app schema, grants)
--   prisma/baseline/02-schema.sql  (generated: prisma migrate diff --from-empty)
--   prisma/baseline/03-schema.sql  (hand-written: RLS, triggers, constraints)
--
-- To change it, edit the relevant source and run:
--   pnpm --filter @abi-desk/db run baseline:rebuild
--
-- This single file replaces the six incremental migrations produced during initial
-- development. Those were squashed because they contained pure churn: a fresh database
-- would have created the Knowledge Base, AI-routing and issue-tracker tables together
-- with their triggers and indexes, only to drop them again in the final step. Squashing
-- before first release is standard practice (Prisma calls it baselining) and is safe
-- precisely because there is no deployed data to preserve.
--
-- Generated ${new Date().toISOString()}
-- =========================================================================

`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${banner}${partOne}\n${generated}\n\n${partThree}`, 'utf8');

const lines = readFileSync(OUT_FILE, 'utf8').split('\n').length;
const tables = (generated.match(/^CREATE TABLE/gm) ?? []).length;
const types = (generated.match(/^CREATE TYPE/gm) ?? []).length;

console.log(`Baseline written: ${OUT_FILE}`);
console.log(`  ${lines} lines, ${tables} tables, ${types} enum types`);
