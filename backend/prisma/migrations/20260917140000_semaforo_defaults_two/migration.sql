-- Replace the original 5-item semáforo seed with the 2 most common prompts.
WITH classic AS (
  SELECT s."templateId"
  FROM "TemplateSemaforoItem" s
  GROUP BY s."templateId"
  HAVING COUNT(*) = 5
     AND COUNT(*) FILTER (
       WHERE s.title = 'Comunicación'
         AND s.description = '¿Nos enteramos a tiempo?'
     ) = 1
     AND COUNT(*) FILTER (WHERE s.title = 'Calidad') = 1
     AND COUNT(*) FILTER (WHERE s.title = 'Carga de trabajo') = 1
     AND COUNT(*) FILTER (WHERE s.title = 'Colaboración') = 1
     AND COUNT(*) FILTER (WHERE s.title = 'Progreso') = 1
),
deleted AS (
  DELETE FROM "TemplateSemaforoItem" s
  USING classic c
  WHERE s."templateId" = c."templateId"
  RETURNING s."templateId"
)
INSERT INTO "TemplateSemaforoItem" ("id", "templateId", "title", "description", "position")
SELECT
  'tsi_' || d."templateId" || '_' || v.position,
  d."templateId",
  v.title,
  v.description,
  v.position
FROM (SELECT DISTINCT "templateId" FROM deleted) d
CROSS JOIN (
  VALUES
    (0, 'Comunicación', '¿Hubo buena comunicación?'),
    (1, 'Tareas asignadas', '¿Te gustaron las tareas asignadas?')
) AS v(position, title, description);
