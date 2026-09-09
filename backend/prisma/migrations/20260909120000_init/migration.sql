-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('facilitator', 'member');
CREATE TYPE "RetroStatus" AS ENUM ('comments', 'grouping', 'voting', 'actions', 'roti', 'closed');
CREATE TYPE "ActionStatus" AS ENUM ('pending', 'doing', 'done');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'member',
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateColumn" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TemplateColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Retrospective" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RetroStatus" NOT NULL DEFAULT 'comments',
    "guestInviteCode" TEXT NOT NULL,
    "memberInviteCode" TEXT NOT NULL,
    "maxCommentsPerParticipant" INTEGER,
    "votesPerParticipant" INTEGER NOT NULL DEFAULT 5,
    "maxVotesPerCard" INTEGER NOT NULL DEFAULT 2,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "timerSeconds" INTEGER,
    "timerEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "Retrospective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetroColumn" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "RetroColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "groupId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CardGroup" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "title" TEXT,
    CONSTRAINT "CardGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "cardId" TEXT,
    "groupId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "retroId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'pending',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RotiResponse" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    CONSTRAINT "RotiResponse_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE UNIQUE INDEX "Retrospective_guestInviteCode_key" ON "Retrospective"("guestInviteCode");
CREATE UNIQUE INDEX "Retrospective_memberInviteCode_key" ON "Retrospective"("memberInviteCode");
CREATE INDEX "Participant_retroId_userId_idx" ON "Participant"("retroId", "userId");
CREATE UNIQUE INDEX "Vote_participantId_cardId_key" ON "Vote"("participantId", "cardId");
CREATE UNIQUE INDEX "Vote_participantId_groupId_key" ON "Vote"("participantId", "groupId");
CREATE UNIQUE INDEX "RotiResponse_retroId_participantId_key" ON "RotiResponse"("retroId", "participantId");

-- Foreign keys
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateColumn" ADD CONSTRAINT "TemplateColumn_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetroColumn" ADD CONSTRAINT "RetroColumn_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RetroColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CardGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CardGroup" ADD CONSTRAINT "CardGroup_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CardGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RotiResponse" ADD CONSTRAINT "RotiResponse_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RotiResponse" ADD CONSTRAINT "RotiResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
