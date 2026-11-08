-- Homepage video spotlight: a single row the admin upserts daily.
CREATE TABLE "SiteVideo" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "title" VARCHAR(140),
    "note" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVideo_pkey" PRIMARY KEY ("id")
);
