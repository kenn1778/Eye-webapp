// One-shot CloudFront update: TLS 1.2 minimum + security headers policy on the
// S3 default behavior. Runs the AWS CLI from node to avoid PowerShell's
// BOM/encoding corruption of JSON round-trips.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIST = "E2MCF24M6PZ89T";
const POLICY_ID = "631fa95a-9678-4ad3-ab7a-c4c52b3b5644";
const tmp = tmpdir();

const raw = execFileSync("aws", [
  "cloudfront", "get-distribution-config", "--id", DIST, "--output", "json",
], { encoding: "utf8" });
const wrapped = JSON.parse(raw);
const { DistributionConfig: cfg, ETag } = wrapped;

cfg.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021";
const b = cfg.DefaultCacheBehavior;
b.ResponseHeadersPolicyId = POLICY_ID;

const cfgPath = join(tmp, "distcfg.json");
writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");

const result = execFileSync("aws", [
  "cloudfront", "update-distribution", "--id", DIST,
  "--distribution-config", `file://${cfgPath.replace(/\\/g, "/")}`,
  "--if-match", ETag,
  "--output", "json",
], { encoding: "utf8" });
const out = JSON.parse(result);
console.log("status:", out.Distribution.Status, "| inProgress:", out.Distribution.InProgressOperationBatches ? "batches" : out.Distribution.InProgressInvalidationBatches ?? "n/a");
console.log("TLS:", cfg.ViewerCertificate.MinimumProtocolVersion, "| headers policy:", POLICY_ID);
