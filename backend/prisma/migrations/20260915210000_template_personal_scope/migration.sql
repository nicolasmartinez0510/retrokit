-- AlterTable
ALTER TABLE "Template" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Template" ADD COLUMN "createdById" TEXT;

-- Existing templates (seed) are universal
UPDATE "Template" SET "isGlobal" = true;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
