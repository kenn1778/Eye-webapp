// Fails if any Prisma migration starts with a UTF-8 BOM (EF BB BF).
//
// Postgres rejects the BOM as a syntax error ("syntax error at or near \ufeff"),
// which blocks `prisma migrate deploy` and therefore the whole deploy. Editing a
// migration in some Windows editors re-adds the BOM, so this guard runs in CI
// and in the deploy script.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "..", "prisma", "migrations");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".sql")) out.push(full);
  }
  return out;
}

const files = walk(migrationsDir);
const bad = files.filter((file) => {
  const bytes = readFileSync(file);
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
});

if (bad.length > 0) {
  console.error("[eye:migrations] FAILED - these files start with a UTF-8 BOM:");
  for (const file of bad) console.error(`  - ${file}`);
  console.error("Re-save them as UTF-8 without BOM (PowerShell: [IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding($false)))).");
  process.exit(1);
}

console.log(`[eye:migrations] OK - ${files.length} migration file(s) have no BOM.`);
