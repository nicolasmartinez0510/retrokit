-- Per-phase vote budgets. Card totals stay cumulative; quotas do not.
ALTER TABLE "RetroPhase" ADD COLUMN "votesPerParticipant" INTEGER;
ALTER TABLE "RetroPhase" ADD COLUMN "maxVotesPerCard" INTEGER;

-- Phases that create cards and had no own cap inherit the retro-wide one.
UPDATE "RetroPhase" AS rp
SET "maxCardsPerParticipant" = r."maxCommentsPerParticipant"
FROM "Retrospective" AS r
WHERE rp."retroId" = r.id
  AND rp."allowCreateCards" = true
  AND rp."maxCardsPerParticipant" IS NULL
  AND r."maxCommentsPerParticipant" IS NOT NULL;

-- Voting phases take the retro's vote budget. Single-vote phases cap at 1 per card.
UPDATE "RetroPhase" AS rp
SET
  "votesPerParticipant" = r."votesPerParticipant",
  "maxVotesPerCard" = CASE WHEN rp.voting = 'single' THEN 1 ELSE r."maxVotesPerCard" END
FROM "Retrospective" AS r
WHERE rp."retroId" = r.id
  AND rp.voting <> 'off';

-- Cards written before a phase was stamped belong to the first card phase.
UPDATE "Card" AS c
SET "createdInPhaseId" = sub.id
FROM (
  SELECT DISTINCT ON (rp."retroId") rp."retroId", rp.id
  FROM "RetroPhase" AS rp
  WHERE rp."allowCreateCards" = true
  ORDER BY rp."retroId", rp.position ASC
) AS sub
WHERE c."retroId" = sub."retroId"
  AND c."createdInPhaseId" IS NULL;

-- Each vote belongs to the phase it was cast in. One voting phase: that one.
-- Several: the first by position. None: the first phase, so the column can be required.
ALTER TABLE "Vote" ADD COLUMN "retroPhaseId" TEXT;

UPDATE "Vote" AS v
SET "retroPhaseId" = sub.id
FROM (
  SELECT DISTINCT ON (rp."retroId") rp."retroId", rp.id
  FROM "RetroPhase" AS rp
  WHERE rp.voting <> 'off'
  ORDER BY rp."retroId", rp.position ASC
) AS sub
WHERE v."retroId" = sub."retroId"
  AND v."retroPhaseId" IS NULL;

UPDATE "Vote" AS v
SET "retroPhaseId" = sub.id
FROM (
  SELECT DISTINCT ON (rp."retroId") rp."retroId", rp.id
  FROM "RetroPhase" AS rp
  ORDER BY rp."retroId", rp.position ASC
) AS sub
WHERE v."retroId" = sub."retroId"
  AND v."retroPhaseId" IS NULL;

DELETE FROM "Vote" WHERE "retroPhaseId" IS NULL;

DROP INDEX IF EXISTS "Vote_participantId_cardId_key";
DROP INDEX IF EXISTS "Vote_participantId_groupId_key";

ALTER TABLE "Vote" ALTER COLUMN "retroPhaseId" SET NOT NULL;

ALTER TABLE "Vote"
  ADD CONSTRAINT "Vote_retroPhaseId_fkey"
  FOREIGN KEY ("retroPhaseId") REFERENCES "RetroPhase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Vote_participantId_cardId_retroPhaseId_key"
  ON "Vote"("participantId", "cardId", "retroPhaseId");
CREATE UNIQUE INDEX "Vote_participantId_groupId_retroPhaseId_key"
  ON "Vote"("participantId", "groupId", "retroPhaseId");
CREATE INDEX "Vote_retroPhaseId_idx" ON "Vote"("retroPhaseId");

-- "I'm ready" is per phase. Classic retros have one phase of each kind.
CREATE TABLE "ParticipantPhaseReady" (
  "participantId" TEXT NOT NULL,
  "retroPhaseId" TEXT NOT NULL,
  "ready" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ParticipantPhaseReady_pkey" PRIMARY KEY ("participantId", "retroPhaseId")
);

ALTER TABLE "ParticipantPhaseReady"
  ADD CONSTRAINT "ParticipantPhaseReady_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParticipantPhaseReady"
  ADD CONSTRAINT "ParticipantPhaseReady_retroPhaseId_fkey"
  FOREIGN KEY ("retroPhaseId") REFERENCES "RetroPhase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ParticipantPhaseReady" ("participantId", "retroPhaseId", "ready")
SELECT p.id, rp.id, true
FROM "Participant" AS p
JOIN "RetroPhase" AS rp ON rp."retroId" = p."retroId"
WHERE p."commentsReady" = true
  AND rp."allowCreateCards" = true
ON CONFLICT ("participantId", "retroPhaseId") DO UPDATE SET "ready" = true;

INSERT INTO "ParticipantPhaseReady" ("participantId", "retroPhaseId", "ready")
SELECT p.id, rp.id, true
FROM "Participant" AS p
JOIN "RetroPhase" AS rp ON rp."retroId" = p."retroId"
WHERE p."votesReady" = true
  AND rp.voting <> 'off'
ON CONFLICT ("participantId", "retroPhaseId") DO UPDATE SET "ready" = true;

INSERT INTO "ParticipantPhaseReady" ("participantId", "retroPhaseId", "ready")
SELECT p.id, rp.id, true
FROM "Participant" AS p
JOIN "RetroPhase" AS rp ON rp."retroId" = p."retroId"
WHERE p."semaforoReady" = true
  AND rp.kind = 'semaforo'
ON CONFLICT ("participantId", "retroPhaseId") DO UPDATE SET "ready" = true;
