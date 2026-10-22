-- The phase-limits backfill copied one global "ready" onto every phase of the
-- same kind. If a person is ready on every phase of a kind, keep only the first
-- by position and drop the copies. A later ready that does not cover every
-- phase of that kind is left as it is.

WITH card_phases AS (
  SELECT id, "retroId", position
  FROM "RetroPhase"
  WHERE "allowCreateCards" = true
),
vote_phases AS (
  SELECT id, "retroId", position
  FROM "RetroPhase"
  WHERE voting <> 'off'
),
semaforo_phases AS (
  SELECT id, "retroId", position
  FROM "RetroPhase"
  WHERE kind = 'semaforo'
),
card_full AS (
  SELECT p.id AS "participantId", p."retroId"
  FROM "Participant" AS p
  JOIN card_phases AS cp ON cp."retroId" = p."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = p.id
   AND r."retroPhaseId" = cp.id
   AND r.ready = true
  GROUP BY p.id, p."retroId"
  HAVING COUNT(*) > 1
     AND COUNT(*) = (
       SELECT COUNT(*) FROM card_phases AS c2 WHERE c2."retroId" = p."retroId"
     )
),
vote_full AS (
  SELECT p.id AS "participantId", p."retroId"
  FROM "Participant" AS p
  JOIN vote_phases AS vp ON vp."retroId" = p."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = p.id
   AND r."retroPhaseId" = vp.id
   AND r.ready = true
  GROUP BY p.id, p."retroId"
  HAVING COUNT(*) > 1
     AND COUNT(*) = (
       SELECT COUNT(*) FROM vote_phases AS v2 WHERE v2."retroId" = p."retroId"
     )
),
semaforo_full AS (
  SELECT p.id AS "participantId", p."retroId"
  FROM "Participant" AS p
  JOIN semaforo_phases AS sp ON sp."retroId" = p."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = p.id
   AND r."retroPhaseId" = sp.id
   AND r.ready = true
  GROUP BY p.id, p."retroId"
  HAVING COUNT(*) > 1
     AND COUNT(*) = (
       SELECT COUNT(*) FROM semaforo_phases AS s2 WHERE s2."retroId" = p."retroId"
     )
),
keep AS (
  SELECT cf."participantId", cp.id AS "retroPhaseId"
  FROM card_full AS cf
  JOIN card_phases AS cp ON cp."retroId" = cf."retroId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM card_phases AS earlier
    WHERE earlier."retroId" = cp."retroId"
      AND (
        earlier.position < cp.position
        OR (earlier.position = cp.position AND earlier.id < cp.id)
      )
  )

  UNION

  SELECT vf."participantId", vp.id AS "retroPhaseId"
  FROM vote_full AS vf
  JOIN vote_phases AS vp ON vp."retroId" = vf."retroId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM vote_phases AS earlier
    WHERE earlier."retroId" = vp."retroId"
      AND (
        earlier.position < vp.position
        OR (earlier.position = vp.position AND earlier.id < vp.id)
      )
  )

  UNION

  SELECT sf."participantId", sp.id AS "retroPhaseId"
  FROM semaforo_full AS sf
  JOIN semaforo_phases AS sp ON sp."retroId" = sf."retroId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM semaforo_phases AS earlier
    WHERE earlier."retroId" = sp."retroId"
      AND (
        earlier.position < sp.position
        OR (earlier.position = sp.position AND earlier.id < sp.id)
      )
  )
),
drop_candidates AS (
  SELECT r."participantId", r."retroPhaseId"
  FROM card_full AS cf
  JOIN card_phases AS cp ON cp."retroId" = cf."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = cf."participantId"
   AND r."retroPhaseId" = cp.id
   AND r.ready = true

  UNION

  SELECT r."participantId", r."retroPhaseId"
  FROM vote_full AS vf
  JOIN vote_phases AS vp ON vp."retroId" = vf."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = vf."participantId"
   AND r."retroPhaseId" = vp.id
   AND r.ready = true

  UNION

  SELECT r."participantId", r."retroPhaseId"
  FROM semaforo_full AS sf
  JOIN semaforo_phases AS sp ON sp."retroId" = sf."retroId"
  JOIN "ParticipantPhaseReady" AS r
    ON r."participantId" = sf."participantId"
   AND r."retroPhaseId" = sp.id
   AND r.ready = true
)
DELETE FROM "ParticipantPhaseReady" AS r
USING drop_candidates AS d
WHERE r."participantId" = d."participantId"
  AND r."retroPhaseId" = d."retroPhaseId"
  AND NOT EXISTS (
    SELECT 1
    FROM keep AS k
    WHERE k."participantId" = r."participantId"
      AND k."retroPhaseId" = r."retroPhaseId"
  );
