// One-command S3 credential bootstrap for the Lightsail backend.
//
// Two ways to run:
//
//  A) Admin access key in a local AWS profile:
//       node scripts/iam-bootstrap.mjs --profile admin
//     The identity needs iam:CreateUser, iam:CreatePolicy, iam:AttachUserPolicy,
//     iam:CreateAccessKey, iam:ListAccessKeys and sts:GetCallerIdentity. The
//     repo's default CLI profile is deliberately least-privilege.
//
//  B) Console-only admin: create the user/policy/key in the AWS console, put
//     the two values into a file (do NOT commit or paste it anywhere):
//         AWS_ACCESS_KEY_ID=AKIA...
//         AWS_SECRET_ACCESS_KEY=...
//     then run:
//         node scripts/iam-bootstrap.mjs --from-file C:\path\to\keys.env
//     IAM steps are skipped; the file is scrubbed after the ssh push and the
//     key values are never printed or logged.
//
// effects (idempotent):
//   1. IAM user            eye-api-lightsail        (created if missing)
//   2. managed policy      eye-lightsail-s3         (List/Get/Put/Delete on the
//                           two app buckets only - nothing account-wide)
//   3. access key          created ONLY if the user has none; refuses to
//                           silently rotate an existing key
//   4. server .env         keys appended via run-remote.ps1; the local temp
//                           file carrying the secret is deleted immediately
//                           after the ssh push.
//
// The Node SDK resolves AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the
// environment first, so the app picks these up with zero code changes.
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const USER = "eye-api-lightsail";
const POLICY_NAME = "eye-lightsail-s3";
const BUCKETS = ["eye-scholarship-media", "eye-scholarship-backup"];

const argv = process.argv.slice(2);
const profile = argv.includes("--profile") ? argv[argv.indexOf("--profile") + 1] : null;
const baseArgs = profile ? ["--profile", profile] : [];
const fromFile = argv.includes("--from-file") ? argv[argv.indexOf("--from-file") + 1] : null;

// Returns { ok, data, errorName } - NEVER masks a failure as success.
function aws(args) {
  const r = spawnSync("aws", [...baseArgs, ...args, "--output", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    const m = /\(AccessDenied\)|not authorized/.test(r.stderr) ? "AccessDenied" : "Other";
    return { ok: false, data: null, errorName: m, stderr: r.stderr.trim() };
  }
  return { ok: true, data: r.stdout ? JSON.parse(r.stdout) : {}, errorName: null, stderr: "" };
}
const fail = (msg, code = 1) => { console.error("ERROR: " + msg); process.exit(code); };

let creds = null;

if (fromFile) {
  // Path B - credentials already exist; validate + carry them silently.
  const txt = readFileSync(fromFile, "utf8");
  const mm = txt.match(/^\s*AWS_ACCESS_KEY_ID\s*=\s*(\S+)\s*$/m);
  const ss = txt.match(/^\s*AWS_SECRET_ACCESS_KEY\s*=\s*(\S+)\s*$/m);
  if (!mm || !ss) fail("the file must contain AWS_ACCESS_KEY_ID=... and AWS_SECRET_ACCESS_KEY=... lines.");
  creds = { AccessKeyId: mm[1], SecretAccessKey: ss[1] };
  console.log(`using credentials from ${fromFile} (values withheld, id ${creds.AccessKeyId.slice(0, 6)}****)`);
} else {
  // Path A - create everything.
  // -- 0. sanity: the invoking identity must be able to see itself -----------
  const me = aws(["sts", "get-caller-identity"]);
  if (!me.ok) fail(`aws sts failed with the ${profile ?? "default"} profile - check the credentials.\n` + me.stderr, 3);
  const account = me.data.Account;

  // -- 1. user ---------------------------------------------------------------
  const getUser = aws(["iam", "get-user", "--user-name", USER]);
  if (getUser.ok) {
    console.log("iam user exists:", USER);
  } else if (getUser.errorName === "AccessDenied") {
    fail(`the invoking identity (${me.data.Arn ?? "unknown"}) may not manage IAM. Run with an admin profile, or use --from-file (console path).\n    node scripts/iam-bootstrap.mjs --profile <admin-profile-name>`, 3);
  } else {
    const created = aws(["iam", "create-user", "--user-name", USER, "--tags", "Key=Project,Value=eye-scholarship", "Key=Role,Value=app-s3"]);
    if (!created.ok) fail("create-user failed:\n" + created.stderr);
    console.log("created iam user:", USER);
  }

  // -- 2. least-privilege policy ---------------------------------------------
  const policy = {
    Version: "2012-10-17",
    Statement: [
      ...BUCKETS.map((b) => ({
        Sid: `BucketLevel${b.split("-").pop()}`,
        Effect: "Allow",
        Action: ["s3:ListBucket", "s3:GetBucketLocation"],
        Resource: `arn:aws:s3:::${b}`,
      })),
      ...BUCKETS.map((b) => ({
        Sid: `ObjectLevel${b.split("-").pop()}`,
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ],
        Resource: `arn:aws:s3:::${b}/*`,
      })),
    ],
  };
  const policyArn = `arn:aws:iam::${account}:policy/${POLICY_NAME}`;
  const getPolicy = aws(["iam", "get-policy", "--policy-arn", policyArn]);
  if (getPolicy.ok) {
    console.log("policy exists:", POLICY_NAME);
  } else if (getPolicy.errorName === "AccessDenied") {
    fail("identity may not read managed policies - run with an admin profile or use --from-file.", 3);
  } else {
    const policyPath = join(tmpdir(), "eye-s3-policy.json");
    writeFileSync(policyPath, JSON.stringify(policy), "utf8");
    const created = aws(["iam", "create-policy", "--policy-name", POLICY_NAME,
      "--policy-document", `file://${policyPath.replace(/\\/g, "/")}`]);
    rmSync(policyPath, { force: true });
    if (!created.ok) fail("create-policy failed:\n" + created.stderr);
    console.log("created policy:", POLICY_NAME, "(2 buckets, object-level only)");
  }
  const attach = aws(["iam", "attach-user-policy", "--user-name", USER, "--policy-arn", policyArn]);
  if (!attach.ok) fail("attach-user-policy failed:\n" + attach.stderr);

  // -- 3. access key (never rotate an existing one silently) -----------------
  const listKeys = aws(["iam", "list-access-keys", "--user-name", USER]);
  if (!listKeys.ok) fail("list-access-keys failed:\n" + listKeys.stderr);
  const keys = listKeys.data.AccessKeyMetadata ?? [];
  if (keys.length > 0) {
    console.log(`user already has ${keys.length} access key(s) - refusing to create another.`);
    console.log("If the existing key is a leftover, delete it first with:");
    console.log(`  aws iam delete-access-key --user-name ${USER} --access-key-id <ID>${baseArgs.length ? " " + baseArgs.join(" ") : ""}`);
    console.log("then re-run this script.");
    process.exit(2);
  }
  const keyCreated = aws(["iam", "create-access-key", "--user-name", USER]);
  if (!keyCreated.ok) fail("create-access-key failed:\n" + keyCreated.stderr);
  creds = keyCreated.data.AccessKey;
  if (!creds?.SecretAccessKey) fail("access key creation returned no secret - aborting, nothing applied.");
  console.log(`created access key ${creds.AccessKeyId.slice(0, 6)}**** (full value withheld)`);
}

// -- 4. push to the server .env via run-remote --------------------------------
const credFile = fromFile ?? join(tmpdir(), "eye-s3-creds.env");
if (!fromFile) {
  writeFileSync(
    credFile,
    `AWS_ACCESS_KEY_ID=${creds.AccessKeyId}\nAWS_SECRET_ACCESS_KEY=${creds.SecretAccessKey}\n`,
    "utf8",
  );
}
const remoteScript = join(process.cwd(), "scripts", ".apply-s3-creds.sh");
writeFileSync(remoteScript, `\
set -euo pipefail
cd /opt/eye/backend
sed -i '/^AWS_ACCESS_KEY_ID=/d;/^AWS_SECRET_ACCESS_KEY=/d' .env
printf '%s\\n' 'AWS_ACCESS_KEY_ID=${creds.AccessKeyId}' 'AWS_SECRET_ACCESS_KEY=${creds.SecretAccessKey}' >> .env
chmod 600 .env
systemctl restart eye-api 2>/dev/null || sudo systemctl restart eye-api
sleep 4
systemctl is-active eye-api
echo "--- healthz detail after restart:"
curl -s -m 10 http://127.0.0.1:4000/healthz
echo
`, "utf8");

console.log("pushing credentials to the Lightsail instance (values not shown)...");
const ps = spawnSync("powershell", [
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", "scripts\\run-remote.ps1", "-ScriptName", ".apply-s3-creds.sh",
], { encoding: "utf8", stdio: "inherit" });

// Purge the local secret copies regardless of outcome.
rmSync(remoteScript, { force: true });
if (!fromFile) rmSync(credFile, { force: true });

if (ps.status !== 0) {
  console.error("remote apply FAILED - the IAM key exists but was NOT applied to .env.");
  console.error("Re-run after fixing ssh (nothing was rotated; the key may still be reused).");
  process.exit(ps.status ?? 1);
}
console.log("done. backend restarted with bucket-scoped credentials.");
