-- CreateEnum
CREATE TYPE "ActionEntryMode" AS ENUM ('retrospectiva', 'weekly', 'planning', 'refinamiento', 'otro');

-- CreateTable
CREATE TABLE "ActionProgressUpdate" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "authorId" TEXT,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "entryMode" "ActionEntryMode" NOT NULL,
    "entryModeCustom" TEXT,
    "progress" TEXT,
    "pending" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionProgressUpdate_actionId_sequence_key" ON "ActionProgressUpdate"("actionId", "sequence");
CREATE INDEX "ActionProgressUpdate_actionId_createdAt_idx" ON "ActionProgressUpdate"("actionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActionProgressUpdate" ADD CONSTRAINT "ActionProgressUpdate_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionProgressUpdate" ADD CONSTRAINT "ActionProgressUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
