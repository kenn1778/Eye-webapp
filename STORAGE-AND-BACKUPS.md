# Persistent media and database backups

The application database is the source of truth for posts, reviews, memberships,
and media metadata. Binary media is stored in a **separate private S3 bucket**;
published post records keep the database metadata and a stable public API URL.
The API redirects readers to a short-lived signed S3 download URL only when the
asset is attached to a published post.

## Required AWS setup

1. Create a private media bucket and a separate private backup bucket in the
   configured AWS region. Enable S3 Block Public Access and default encryption.
2. Give the backend host/task an IAM role, not hard-coded AWS access keys. Grant
   it `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, and multipart-upload
   permissions only for the media bucket's `media/*` prefix. Grant the backup
   job `s3:PutObject` and multipart-upload permissions only for the backup
   bucket's configured backup prefix.
3. Set `AWS_REGION`, `S3_MEDIA_BUCKET`, and `S3_BACKUP_BUCKET` in the backend
   environment. Optionally set `S3_MEDIA_PUBLIC_BASE_URL` to the API origin when
   the frontend and API are hosted on different origins. Configure CORS on the
   media bucket to allow `PUT` from the admin frontend origin and expose the
   `ETag` response header. CORS is not an access-control mechanism; signed URLs
   and IAM authorize uploads.
4. Deploy the backend. Docker startup runs `prisma migrate deploy` before the
   server begins accepting traffic. Non-Docker deployments must run
   `npx prisma migrate deploy` from `backend/` as a release step.
5. Install PostgreSQL client tools compatible with the server (`pg_dump`) on a
   trusted backup runner and provide `DATABASE_URL` plus the backup bucket's
   IAM role. Run `npm run backup:s3` from `backend/` to create a custom-format
   logical dump and stream it to S3. Schedule this daily with a host timer or
   managed scheduler and alert on non-zero exits. Example Linux crontab entry
   for the Docker Compose deployment at 02:15 UTC daily: `15 2 * * * cd
   /opt/eye && docker compose --profile backup run --rm backup >>
   /var/log/eye-backup.log 2>&1`. For a host-runner deployment use
   `cd /opt/eye/backend && npm run backup:s3` instead. The runner must have
   `pg_dump`, network access to Postgres, and its AWS IAM role attached.
6. Apply an S3 lifecycle policy to the backup prefix (for example, transition
   older backups to archival storage and expire after the desired retention).
   Keep S3 versioning or Object Lock if required by the recovery policy. Test
   restores regularly; a successful upload alone is not proof of recoverability.

## Restore test

Download a selected `.dump` backup in a controlled environment and restore it
into a fresh PostgreSQL database with `pg_restore --clean --if-exists --no-owner
--no-acl --dbname="$RESTORE_DATABASE_URL" backup.dump`. Never test a destructive
restore against the live production database.

RDS automated snapshots/PITR should remain enabled as a separate recovery layer.
The S3 `pg_dump` workflow is a portable off-site logical backup, not a substitute
for database snapshots. The app cannot use S3 or survive database loss until
AWS buckets/IAM and `DATABASE_URL` are configured in the deployed environment.