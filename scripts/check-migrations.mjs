#!/usr/bin/env node
/**
 * Checks that migration files form a gapless numbered sequence.
 * Catches cases where a migration was applied to production via MCP
 * but the file was never committed.
 *
 * Usage: node scripts/check-migrations.mjs
 */

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No migration files found.');
  process.exit(1);
}

let ok = true;

const numbers = files.map(f => {
  const m = f.match(/^(\d+)_/);
  if (!m) {
    console.error(`ERROR: Migration file has unexpected name format: ${f}`);
    ok = false;
    return null;
  }
  return parseInt(m[1], 10);
}).filter(n => n !== null);

// Check for duplicates
const seen = new Set();
for (const n of numbers) {
  if (seen.has(n)) {
    console.error(`ERROR: Duplicate migration number: ${n.toString().padStart(5, '0')}`);
    ok = false;
  }
  seen.add(n);
}

// Check for gaps (allow non-consecutive numbering as long as it's monotonically increasing)
const sorted = [...numbers].sort((a, b) => a - b);
for (let i = 1; i < sorted.length; i++) {
  if (sorted[i] <= sorted[i - 1]) {
    console.error(`ERROR: Migration numbers are not monotonically increasing: ${sorted[i - 1]} → ${sorted[i]}`);
    ok = false;
  }
}

if (ok) {
  console.log(`✓ ${files.length} migration files — sequence looks good.`);
  for (const f of files) console.log(`  ${f}`);
} else {
  process.exit(1);
}
