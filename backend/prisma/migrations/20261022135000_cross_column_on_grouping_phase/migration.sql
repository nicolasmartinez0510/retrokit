-- A retro-wide "group across columns" choice belongs on the phases that group.
UPDATE "RetroPhase" AS rp
SET "allowCrossColumnGrouping" = true
FROM "Retrospective" AS r
WHERE rp."retroId" = r.id
  AND rp."allowGrouping" = true
  AND r."allowCrossColumnGrouping" = true
  AND rp."allowCrossColumnGrouping" = false;
