// Push the GA4 service-account key to the server and finish backend wiring.
// Steps: repo-root ga4-key.json -> base64 over ssh -> /opt/eye/backend/secrets/
// ga4-key.json (chmod 600), GA4_PROPERTY_ID + GA4_KEY_FILE in .env, restart,
// verify via admin endpoint smoke. The local key copy is never printed and the
// remote copy lives only on the instance.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY_LOCAL = join(process.cwd(), "ga4-key.json");
const PROPERTY_ID = process.env.GA4_PROPERTY_ID_ARG ?? "344311243";
if (!existsSync(KEY_LOCAL)) {
  console.error("ERROR: save the service-account JSON as ga4-key.json in the repo root first.");
  process.exit(2);
}
let keyJson;
try {
  keyJson = JSON.parse(readFileSync(KEY_LOCAL, "utf8"));
} catch {
  console.error("ERROR: ga4-key.json is not valid JSON - re-download the key.");
  process.exit(2);
}
if (!keyJson.client_email || !keyJson.private_key) {
  console.error("ERROR: ga4-key.json lacks client_email/private_key - is it a service-account key?");
  process.exit(2);
}
const b64 = readFileSync(KEY_LOCAL).toString("base64");

const remoteScript = join(process.cwd(), "scripts", ".apply-ga4.sh");
writeFileSync(remoteScript, `\
set -euo pipefail
cd /opt/eye/backend
mkdir -p secrets
echo ${b64} | base64 -d > secrets/ga4-key.json
chmod 600 secrets/ga4-key.json
python3 - <<'PY'
import json, pathlib
key = json.loads(pathlib.Path("secrets/ga4-key.json").read_text())
print("key email:", key.get("client_email", "?"))
PY
sed -i '/^GA4_PROPERTY_ID=/d;/^GA4_KEY_FILE=/d' .env
printf '%s\\n' 'GA4_PROPERTY_ID=${PROPERTY_ID}' 'GA4_KEY_FILE=/opt/eye/backend/secrets/ga4-key.json' >> .env
chmod 600 .env
systemctl restart eye-api 2>/dev/null || sudo systemctl restart eye-api
sleep 4
systemctl is-active eye-api
echo "--- healthz:"
curl -s -m 10 http://127.0.0.1:4000/healthz
echo
echo "--- ga4 endpoint (admin session still required, but config probe):"
curl -s -m 10 -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:4000/api/v1/admin/analytics
`, "utf8");

console.log("pushing service-account key (value never shown)...");
const ps = spawnSync("powershell", [
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", "scripts\\run-remote.ps1", "-ScriptName", ".apply-ga4.sh",
], { encoding: "utf8", stdio: "inherit" });
rmSync(remoteScript, { force: true });
if (ps.status !== 0) {
  console.error("remote apply FAILED - key was generated but NOT installed; keep ga4-key.json and re-run.");
  process.exit(ps.status ?? 1);
}
console.log("done. Backend uses the GA4 credentials; add", keyJson.client_email,
  "as Viewer on the property if you have not already.");
