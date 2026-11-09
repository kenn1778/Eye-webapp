# End-to-end S3 test using the same env the app runs with: PUT + HEAD + DELETE.
set -euo pipefail
cd /opt/eye/backend
KID=$(grep '^AWS_ACCESS_KEY_ID=' .env | head -1 | cut -d= -f2- | tr -d '\r')
KSC=$(grep '^AWS_SECRET_ACCESS_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r')
REG=$(grep '^AWS_REGION=' .env | head -1 | cut -d= -f2- | tr -d '\r')
BUCKET=$(grep '^S3_MEDIA_BUCKET=' .env | head -1 | cut -d= -f2- | tr -d '\r')
AWS_ACCESS_KEY_ID="$KID" AWS_SECRET_ACCESS_KEY="$KSC" AWS_REGION="$REG" BUCKET="$BUCKET" node --input-type=module -e '
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const key = `ops-smoke-test/${Date.now()}.txt`;
const body = "xplore s3 health smoke test";
try {
  await s3.send(new PutObjectCommand({ Bucket: process.env.BUCKET, Key: key, Body: body, ContentType: "text/plain" }));
  const got = await s3.send(new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key }));
  const read = await got.Body.transformToString();
  console.log("PUT+GET OK | content round-trip:", read === body ? "exact match" : "MISMATCH");
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.BUCKET, Key: key }));
  console.log("DELETE OK | key:", key, "cleaned up");
} catch (e) {
  console.log("SMOKE TEST ERROR:", e.name, "|", (e.message || String(e)).slice(0, 140));
  process.exit(1);
}
'
echo "--- final healthz:"
curl -s -m 10 http://127.0.0.1:4000/healthz
