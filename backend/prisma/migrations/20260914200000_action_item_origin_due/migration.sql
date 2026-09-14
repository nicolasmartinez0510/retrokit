-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "ActionItem" ADD COLUMN "cardId" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN "groupId" TEXT;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CardGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
