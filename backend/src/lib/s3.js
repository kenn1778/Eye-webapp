import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";

export const mediaStorageEnabled = Boolean(config.awsRegion && config.s3MediaBucket);
export const backupStorageEnabled = Boolean(config.awsRegion && config.s3BackupBucket);

// In AWS, credentials are resolved from the task/instance role. Do not put
// long-lived access keys in the application environment.
export const s3 = new S3Client({
  region: config.awsRegion || process.env.AWS_REGION || "us-east-1",
  ...(config.s3Endpoint ? { endpoint: config.s3Endpoint } : {}),
  ...(config.s3ForcePathStyle ? { forcePathStyle: true } : {}),
});

export function publicMediaPath(id) {
  return `${config.s3MediaPublicBaseUrl}/api/v1/public/media/${encodeURIComponent(id)}`;
}
