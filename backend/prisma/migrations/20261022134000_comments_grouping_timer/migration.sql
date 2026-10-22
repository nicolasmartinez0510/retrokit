-- System comments and grouping phases default to a 10 minute timer.
UPDATE "Phase"
SET "timerSeconds" = 600
WHERE "id" IN ('sys_phase_comments', 'sys_phase_grouping')
  AND "timerSeconds" IS NULL;

UPDATE "RetroPhase"
SET "timerSeconds" = 600
WHERE "sourcePhaseId" IN ('sys_phase_comments', 'sys_phase_grouping')
  AND "timerSeconds" IS NULL;
