-- AlterTable
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN "createdById" TEXT;

-- Backfill createdById from ownerId where present
UPDATE "ActionItem" SET "createdById" = "ownerId" WHERE "ownerId" IS NOT NULL AND "createdById" IS NULL;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
