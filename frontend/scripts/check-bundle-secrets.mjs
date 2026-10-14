// Fails the build if any backend secret leaks into the public frontend bundle.
//
// Vite inlines every VITE_* variable into dist/, so a stray secret there would
// be downloadable by anyone. This scans the built output for the actual secret
// values in backend/.env and for common credential shapes. It runs as the last
// step of `npm run build`, so a leak can never ship.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "..", "dist");
const envPath = resolve(here, "..", "..", "backend", ".env");

if (!existsSync(distDir)) {
  console.error("[eye:secrets] dist/ not found - run the build first.");
  process.exit(1);
}

// Exact values that must never appear in the bundle.
const forbidden = [];
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    if (value && /PASSWORD|SECRET|KEY|TOKEN|HASH|DATABASE_URL/.test(key)) {
      forbidden.push({ label: key, value });
    }
  }
}

// Generic shapes that indicate a leaked credential.
const patterns = [
  { label: "Google API key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { label: "bcrypt hash", re: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/ },
  { label: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "postgres URL", re: /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/ },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(distDir);
const findings = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const { label, value } of forbidden) {
    if (value.length >= 6 && content.includes(value)) {
      findings.push(`${label} value found in ${file}`);
    }
  }
  for (const { label, re } of patterns) {
    if (re.test(content)) findings.push(`${label} pattern found in ${file}`);
  }
}

if (findings.length > 0) {
  console.error("[eye:secrets] FAILED - secrets detected in the frontend bundle:");
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`[eye:secrets] OK - scanned ${files.length} bundle files, no secrets found.`);
