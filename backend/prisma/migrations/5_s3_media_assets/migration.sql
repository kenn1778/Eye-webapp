ALTER TABLE "Post" ADD COLUMN "mediaAssetId" TEXT;
ALTER TABLE "Post"
    ADD COLUMN "linkHeaderAssetId" TEXT,
    ADD COLUMN "audioAssetId" TEXT,
    ADD COLUMN "videoAssetId" TEXT;
ALTER TABLE "Post"
    ADD COLUMN "linkHeaderUrl" TEXT,
    ADD COLUMN "audioUrl" TEXT,
    ADD COLUMN "videoUrl" TEXT;

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "altText" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");
CREATE INDEX "MediaAsset_uploadedBy_createdAt_idx" ON "MediaAsset"("uploadedBy", "createdAt");
CREATE INDEX "Post_mediaAssetId_idx" ON "Post"("mediaAssetId");
CREATE INDEX "Post_linkHeaderAssetId_idx" ON "Post"("linkHeaderAssetId");
CREATE INDEX "Post_audioAssetId_idx" ON "Post"("audioAssetId");
CREATE INDEX "Post_videoAssetId_idx" ON "Post"("videoAssetId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_linkHeaderAssetId_fkey"
    FOREIGN KEY ("linkHeaderAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_audioAssetId_fkey"
    FOREIGN KEY ("audioAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_videoAssetId_fkey"
    FOREIGN KEY ("videoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;