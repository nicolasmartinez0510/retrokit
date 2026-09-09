-- AlterTable
ALTER TABLE "TemplateColumn" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- AlterTable
ALTER TABLE "RetroColumn" ADD COLUMN IF NOT EXISTS "description" TEXT;
