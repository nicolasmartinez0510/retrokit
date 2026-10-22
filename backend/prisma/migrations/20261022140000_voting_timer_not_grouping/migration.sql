-- Voting defaults to 10 minutes. Grouping does not use a timer.
UPDATE "Phase"
SET "timerSeconds" = 600
WHERE "id" = 'sys_phase_voting'
  AND "timerSeconds" IS NULL;

UPDATE "RetroPhase"
SET "timerSeconds" = 600
WHERE "sourcePhaseId" = 'sys_phase_voting'
  AND "timerSeconds" IS NULL;

UPDATE "Phase"
SET "timerSeconds" = NULL
WHERE "id" = 'sys_phase_grouping'
  AND "timerSeconds" = 600;

UPDATE "RetroPhase"
SET "timerSeconds" = NULL
WHERE "sourcePhaseId" = 'sys_phase_grouping'
  AND "timerSeconds" = 600;
