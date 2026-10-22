-- The system grouping phase is only for grouping cards that already exist.
UPDATE "Phase"
SET "allowCreateCards" = false, "allowEditOwnCards" = false
WHERE "id" = 'sys_phase_grouping';

UPDATE "RetroPhase"
SET "allowCreateCards" = false, "allowEditOwnCards" = false
WHERE "sourcePhaseId" = 'sys_phase_grouping';
