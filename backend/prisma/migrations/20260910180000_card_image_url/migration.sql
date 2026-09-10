-- AlterTable
ALTER TABLE "Card" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Card" ALTER COLUMN "content" SET DEFAULT '';
