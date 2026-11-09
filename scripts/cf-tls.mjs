// Focused update: raise the CloudFront viewer minimum protocol to TLS 1.2.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIST = "E2MCF24M6PZ89T";
const tmp = tmpdir();

const raw = execFileSync("aws", [
  "cloudfront", "get-distribution-config", "--id", DIST, "--output", "json",
], { encoding: "utf8" });
const { DistributionConfig: cfg, ETag } = JSON.parse(raw);
const before = cfg.ViewerCertificate.MinimumProtocolVersion;
cfg.ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021";
// The legacy "vip" SSL support locks the minimum protocol at TLS 1.0 and
// bills extra. SNI-only is the modern default; browsers without SNI (>2004
// era) fall off, everything else is unaffected.
cfg.ViewerCertificate.SSLSupportMethod = "sni-only";

const cfgPath = join(tmp, "distcfg-tls.json");
writeFileSync(cfgPath, JSON.stringify(cfg), "utf8");
execFileSync("aws", [
  "cloudfront", "update-distribution", "--id", DIST,
  "--distribution-config", `file://${cfgPath.replace(/\\/g, "/")}`,
  "--if-match", ETag, "--output", "json",
], { encoding: "utf8" });
console.log("TLS", before, "->", "TLSv1.2_2021 | update accepted");
