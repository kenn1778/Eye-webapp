import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Upload } from "@aws-sdk/lib-storage";
import { config } from "../src/config.js";
import { backupStorageEnabled, s3 } from "../src/lib/s3.js";

if (!config.databaseUrl) throw new Error("DATABASE_URL is required to create a database backup.");
if (!backupStorageEnabled) throw new Error("AWS_REGION and S3_BACKUP_BUCKET are required for S3 backups.");

const directory = await mkdtemp(join(tmpdir(), "eye-db-backup-"));
const filename = `eye-postgres-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
const filePath = join(directory, filename);

try {
  const dump = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-acl", config.databaseUrl], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  dump.stderr.setEncoding("utf8");
  dump.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-8000); });
  const writeTask = pipeline(dump.stdout, createWriteStream(filePath, { flags: "wx" }));
  const exitTask = new Promise((resolve, reject) => {
    dump.once("error", reject);
    dump.once("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}: ${stderr.trim()}`)));
  });
  await Promise.all([writeTask, exitTask]);

  const { size } = await stat(filePath);
  const key = `${config.s3BackupPrefix}/${new Date().toISOString().slice(0, 10)}/${filename}`;
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: config.s3BackupBucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: "application/vnd.postgresql.backup",
      ...(process.env.S3_BACKUP_SSE_KMS_KEY_ID
        ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: process.env.S3_BACKUP_SSE_KMS_KEY_ID }
        : { ServerSideEncryption: "AES256" }),
      Metadata: { database: "eye-postgres", createdat: new Date().toISOString() },
    },
    partSize: 10 * 1024 * 1024,
    queueSize: 2,
    leavePartsOnError: false,
  });
  await upload.done();
  console.info(`[eye:backup] uploaded s3://${config.s3BackupBucket}/${key} (${size} bytes)`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
