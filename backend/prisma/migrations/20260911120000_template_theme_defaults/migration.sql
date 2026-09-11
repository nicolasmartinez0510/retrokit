-- AlterTable
ALTER TABLE "Template" ADD COLUMN "maxCommentsPerParticipant" INTEGER;
ALTER TABLE "Template" ADD COLUMN "votesPerParticipant" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Template" ADD COLUMN "maxVotesPerCard" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Template" ADD COLUMN "backgroundColor" TEXT;
ALTER TABLE "Template" ADD COLUMN "backgroundImageUrl" TEXT;

-- AlterTable
ALTER TABLE "TemplateColumn" ADD COLUMN "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Retrospective" ADD COLUMN "backgroundColor" TEXT;
ALTER TABLE "Retrospective" ADD COLUMN "backgroundImageUrl" TEXT;

-- AlterTable
ALTER TABLE "RetroColumn" ADD COLUMN "logoUrl" TEXT;

-- Seeded-style defaults for existing templates
UPDATE "Template" SET "maxCommentsPerParticipant" = 3 WHERE "maxCommentsPerParticipant" IS NULL;
