#!/usr/bin/env node
/**
 * Proves the baseline applies cleanly to a genuinely empty database.
 *
 *   pnpm --filter @abi-desk/db run baseline:verify
 *
 * ## Why a scratch database rather than trusting the dev one
 *
 * The development database was migrated incrementally over time, so it can be
 * correct for reasons that no longer exist in the migration files - a column added
 * by a migration that was later edited, an index created by hand during debugging.
 * Asserting against it proves the *database* is right, not that the *baseline* is.
 *
 * This creates a throwaway database, applies the baseline to it through the real
 * production code path (`prisma migrate deploy`, not raw psql), runs both structural
 * check scripts against the result, and drops it. That is the same sequence a first
 * production deploy performs, compressed into a few seconds.
 *
 * ## Why `migrate deploy` and not `psql -f migration.sql`
 *
 * `migrate deploy` is what actually runs in the container entrypoint. It creates
 * `_prisma_migrations`, wraps the file in its own transaction and applies its own
 * advisory locking. Running the SQL directly would skip all three and verify a path
 * nobody uses.
 *
 * ## What a failure means
 *
 *   - `migrate deploy` fails      -> the baseline SQL is invalid or mis-ordered.
 *   - the part-3 self-check       -> the migration built something it did not intend
 *     raises                         (e.g. a table without an RLS policy).
 *   - deployment-verify fails     -> the finished database is not in the expected state.
 *   - feature-coverage fails      -> the squash dropped an object a shipped feature needs.
 *
 * Requires the compose stack to be up, because it drives psql inside the postgres
 * container - the same mechanism every other check script in this repo uses.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const repoRoot = join(packageRoot, '..', '..');

const SCRATCH_DB = 'abidesk_baseline_verify';

/** Reads a single key out of the repo `.env` without pulling in a parser. */
function envValue(key) {
  const text = readFileSync(join(repoRoot, '.env'), 'utf8');
  const line = text
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${key}=`) && !l.trim().startsWith('#'));

  if (!line) throw new Error(`${key} is not set in .env`);
  return line.slice(line.indexOf('=') + 1).trim();
}

/** Runs psql inside the postgres container. */
function psql(args, { database = 'postgres', allowFailure = false } = {}) {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', database, ...args],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (result.error) {
    throw new Error(
      `Could not run psql via docker compose: ${result.error.message}\n` +
        'Is the compose stack running? Try: docker compose up -d',
    );
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`psql exited ${result.status}\n${output}`);
  }

  return { status: result.status, output };
}

function dropScratch() {
  // FORCE terminates any leftover connection; without it a stale session from a
  // previous aborted run makes DROP DATABASE hang rather than fail.
  psql(['-q', '-c', `DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`], {
    allowFailure: true,
  });
}

function step(label) {
  process.stdout.write(`  ${label.padEnd(52, '.')} `);
}

let created = false;

try {
  console.log(`\nVerifying the baseline against a scratch database (${SCRATCH_DB})\n`);

  step('drop any leftover scratch database');
  dropScratch();
  console.log('ok');

  step('create empty scratch database');
  // Owned by the migration role, exactly as a provisioned production database is.
  psql(['-q', '-c', `CREATE DATABASE ${SCRATCH_DB} OWNER ${envValue('POSTGRES_OWNER_USER')}`]);
  created = true;
  console.log('ok');

  step('apply baseline via prisma migrate deploy');
  // Point both URLs at the scratch database. Prisma reads `directUrl` for
  // migrations, so overriding only DATABASE_URL would migrate the real one.
  const scratchUrl = envValue('MIGRATION_DATABASE_URL').replace(
    /\/[^/?]+(\?|$)/,
    `/${SCRATCH_DB}$1`,
  );

  if (!scratchUrl.includes(SCRATCH_DB)) {
    throw new Error(`Refusing to continue: could not retarget the URL at ${SCRATCH_DB}.`);
  }

  const deploy = spawnSync(
    'pnpm',
    ['exec', 'prisma', 'migrate', 'deploy', '--schema=./prisma/schema'],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: scratchUrl, MIGRATION_DATABASE_URL: scratchUrl },
    },
  );

  if (deploy.status !== 0) {
    console.log('FAILED');
    throw new Error(
      `prisma migrate deploy failed on an empty database.\n${deploy.stdout}${deploy.stderr}`,
    );
  }

  const applied = (deploy.stdout.match(/Applying migration/g) ?? []).length;
  console.log(`ok (${applied} migration${applied === 1 ? '' : 's'})`);

  if (applied !== 1) {
    throw new Error(
      `Expected exactly 1 migration on a fresh database, ${applied} were applied. ` +
        'The history is no longer squashed.',
    );
  }

  for (const [label, file] of [
    ['deployment-verify.sql', '/checks/deployment-verify.sql'],
    ['feature-coverage.sql', '/checks/feature-coverage.sql'],
  ]) {
    step(`run ${label}`);
    const { status, output } = psql(['-q', '-v', 'ON_ERROR_STOP=1', '-f', file], {
      database: SCRATCH_DB,
      allowFailure: true,
    });

    if (status !== 0) {
      console.log('FAILED');
      throw new Error(output);
    }

    const passes = (output.match(/PASS/g) ?? []).length;
    console.log(`ok (${passes} assertions)`);
  }

  console.log(
    '\nBaseline verified: a fresh database reaches the expected state in one migration.\n',
  );
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (created) {
    // Always cleaned up, including on failure: a leftover database would make the
    // next run's CREATE fail and look like a different problem.
    dropScratch();
  }
}
