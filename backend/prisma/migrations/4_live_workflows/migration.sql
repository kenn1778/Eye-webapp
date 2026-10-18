-- Extend content records for the publishing workflow.
-- Repair these fields for installations that already applied the original
-- audit migration before response outcomes were added to the Prisma model.
ALTER TABLE "AuditLog"
    ADD COLUMN IF NOT EXISTS "statusCode" INTEGER NOT NULL DEFAULT 200,
    ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN "name" TEXT;

ALTER TABLE "Post"
    ADD COLUMN "excerpt" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Scholarships',
    ADD COLUMN "image" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "actionUrl" TEXT,
    ADD COLUMN "actionLabel" TEXT,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN "publishedAt" TIMESTAMP(3),
    ADD COLUMN "deletedAt" TIMESTAMP(3),
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");
CREATE INDEX "Post_deletedAt_createdAt_idx" ON "Post"("deletedAt", "createdAt");

-- Community joins use a browser-scoped anonymous visitor id, never an email.
CREATE TABLE "CommunityMembership" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityMembership_visitorId_communityId_key" ON "CommunityMembership"("visitorId", "communityId");
CREATE INDEX "CommunityMembership_communityId_createdAt_idx" ON "CommunityMembership"("communityId", "createdAt");
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Public reviews include a display name and moderation state.
ALTER TABLE "Review" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Reader';
ALTER TABLE "Review" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Review_published_createdAt_idx" ON "Review"("published", "createdAt");

-- Persist the single-admin profile, including a DB-backed password override.
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Administrator',
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminProfile_email_key" ON "AdminProfile"("email");

-- Persist team invites; actual email delivery and separate moderator login
-- require an email provider and multi-user authorization, which are not set up.
CREATE TABLE "Moderator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Moderator',
    "status" TEXT NOT NULL DEFAULT 'Invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Moderator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Moderator_email_key" ON "Moderator"("email");
CREATE INDEX "Moderator_status_createdAt_idx" ON "Moderator"("status", "createdAt");