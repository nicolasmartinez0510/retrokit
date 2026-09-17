-- CreateEnum
CREATE TYPE "PhaseKind" AS ENUM ('board', 'action_plan', 'roti', 'semaforo', 'semaforo_review');
CREATE TYPE "CardContentMode" AS ENUM ('text_and_image', 'image_only', 'text_only');
CREATE TYPE "OthersVisibility" AS ENUM ('visible', 'blurred', 'hidden');
CREATE TYPE "VotingMode" AS ENUM ('off', 'single', 'multi');
CREATE TYPE "CardSort" AS ENUM ('original', 'most_voted', 'least_voted', 'random');
CREATE TYPE "SemaforoValue" AS ENUM ('red', 'yellow', 'green');

-- CreateTable Phase
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PhaseKind" NOT NULL DEFAULT 'board',
    "icon" TEXT,
    "color" TEXT,
    "instructions" TEXT,
    "timerSeconds" INTEGER,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "allowCreateCards" BOOLEAN NOT NULL DEFAULT true,
    "cardContent" "CardContentMode" NOT NULL DEFAULT 'text_and_image',
    "maxCardsPerParticipant" INTEGER,
    "allowEditOwnCards" BOOLEAN NOT NULL DEFAULT true,
    "anonymousCards" BOOLEAN NOT NULL DEFAULT false,
    "othersVisibility" "OthersVisibility" NOT NULL DEFAULT 'visible',
    "revealOnReady" BOOLEAN NOT NULL DEFAULT false,
    "allowGrouping" BOOLEAN NOT NULL DEFAULT false,
    "allowCrossColumnGrouping" BOOLEAN NOT NULL DEFAULT false,
    "voting" "VotingMode" NOT NULL DEFAULT 'off',
    "hideVoteCounts" BOOLEAN NOT NULL DEFAULT false,
    "allowReactions" BOOLEAN NOT NULL DEFAULT false,
    "reactionEmojis" TEXT[] DEFAULT ARRAY['👍', '❤️', '🎉', '😮', '😕']::TEXT[],
    "allowPresentation" BOOLEAN NOT NULL DEFAULT false,
    "allowActionItems" BOOLEAN NOT NULL DEFAULT false,
    "showReadyCheck" BOOLEAN NOT NULL DEFAULT true,
    "defaultSort" "CardSort" NOT NULL DEFAULT 'original',
    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Phase" ADD CONSTRAINT "Phase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed system presets (fixed ids)
INSERT INTO "Phase" (
  "id", "name", "description", "kind", "icon", "color", "instructions",
  "isGlobal", "isSystem",
  "allowCreateCards", "cardContent", "allowEditOwnCards",
  "anonymousCards", "othersVisibility", "revealOnReady",
  "allowGrouping", "allowCrossColumnGrouping",
  "voting", "hideVoteCounts", "allowReactions",
  "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
) VALUES
(
  'sys_phase_comments', 'Comentarios',
  'Escribir sin ver lo que ponen los demás',
  'board', '💬', NULL, 'Escribí tus ideas. Los demás no las ven todavía.',
  true, true,
  true, 'text_and_image', true,
  false, 'hidden', false,
  false, false,
  'off', false, false,
  false, false, true, 'original'
),
(
  'sys_phase_grouping', 'Agrupar',
  'Agrupar tarjetas similares',
  'board', '🗂', NULL, 'Agrupá las ideas que van juntas.',
  true, true,
  true, 'text_and_image', true,
  false, 'visible', false,
  true, false,
  'off', false, false,
  false, false, true, 'original'
),
(
  'sys_phase_voting', 'Votar',
  'Votar las ideas más importantes',
  'board', '👍', NULL, 'Distribuí tus votos entre las ideas.',
  true, true,
  false, 'text_and_image', false,
  false, 'visible', false,
  false, false,
  'multi', false, false,
  false, false, true, 'original'
),
(
  'sys_phase_actions', 'Plan de acción',
  'Definir accionables a partir de los temas',
  'action_plan', '✅', NULL, 'Definí qué vamos a hacer con lo más votado.',
  true, true,
  false, 'text_and_image', false,
  false, 'visible', false,
  false, false,
  'off', false, false,
  true, true, false, 'most_voted'
),
(
  'sys_phase_roti', 'ROTI',
  'Return on Time Invested',
  'roti', '⭐', NULL, '¿Valió la pena el tiempo invertido?',
  true, true,
  false, 'text_and_image', false,
  false, 'visible', false,
  false, false,
  'off', false, false,
  false, false, false, 'original'
),
(
  'sys_phase_semaforo', 'Semáforo',
  'Health check: pintar cada ítem rojo, amarillo o verde',
  'semaforo', '🚦', NULL, 'Pintá cada ítem según cómo lo ves.',
  true, true,
  false, 'text_and_image', false,
  false, 'visible', false,
  false, false,
  'off', false, false,
  false, false, true, 'original'
),
(
  'sys_phase_semaforo_review', 'Analizar semáforo',
  'Revisar el resultado del semáforo y crear accionables',
  'semaforo_review', '📊', NULL, 'Discutí los ítems en rojo y amarillo.',
  true, true,
  false, 'text_and_image', false,
  false, 'visible', false,
  false, false,
  'off', false, false,
  false, true, false, 'original'
);

-- TemplatePhase
CREATE TABLE "TemplatePhase" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TemplatePhase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TemplatePhase_templateId_phaseId_key" ON "TemplatePhase"("templateId", "phaseId");
ALTER TABLE "TemplatePhase" ADD CONSTRAINT "TemplatePhase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplatePhase" ADD CONSTRAINT "TemplatePhase_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TemplatePhaseHiddenColumn
CREATE TABLE "TemplatePhaseHiddenColumn" (
    "templatePhaseId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    CONSTRAINT "TemplatePhaseHiddenColumn_pkey" PRIMARY KEY ("templatePhaseId","columnId")
);
ALTER TABLE "TemplatePhaseHiddenColumn" ADD CONSTRAINT "TemplatePhaseHiddenColumn_templatePhaseId_fkey" FOREIGN KEY ("templatePhaseId") REFERENCES "TemplatePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplatePhaseHiddenColumn" ADD CONSTRAINT "TemplatePhaseHiddenColumn_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "TemplateColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TemplateSemaforoItem
CREATE TABLE "TemplateSemaforoItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "TemplateSemaforoItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TemplateSemaforoItem" ADD CONSTRAINT "TemplateSemaforoItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed TemplatePhase for existing templates (classic 5)
INSERT INTO "TemplatePhase" ("id", "templateId", "phaseId", "position")
SELECT
  'tp_' || t."id" || '_comments', t."id", 'sys_phase_comments', 0
FROM "Template" t;
INSERT INTO "TemplatePhase" ("id", "templateId", "phaseId", "position")
SELECT
  'tp_' || t."id" || '_grouping', t."id", 'sys_phase_grouping', 1
FROM "Template" t;
INSERT INTO "TemplatePhase" ("id", "templateId", "phaseId", "position")
SELECT
  'tp_' || t."id" || '_voting', t."id", 'sys_phase_voting', 2
FROM "Template" t;
INSERT INTO "TemplatePhase" ("id", "templateId", "phaseId", "position")
SELECT
  'tp_' || t."id" || '_actions', t."id", 'sys_phase_actions', 3
FROM "Template" t;
INSERT INTO "TemplatePhase" ("id", "templateId", "phaseId", "position")
SELECT
  'tp_' || t."id" || '_roti', t."id", 'sys_phase_roti', 4
FROM "Template" t;

-- RetroPhase (without currentPhase FK yet)
CREATE TABLE "RetroPhase" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourcePhaseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PhaseKind" NOT NULL DEFAULT 'board',
    "icon" TEXT,
    "color" TEXT,
    "instructions" TEXT,
    "timerSeconds" INTEGER,
    "allowCreateCards" BOOLEAN NOT NULL DEFAULT true,
    "cardContent" "CardContentMode" NOT NULL DEFAULT 'text_and_image',
    "maxCardsPerParticipant" INTEGER,
    "allowEditOwnCards" BOOLEAN NOT NULL DEFAULT true,
    "anonymousCards" BOOLEAN NOT NULL DEFAULT false,
    "othersVisibility" "OthersVisibility" NOT NULL DEFAULT 'visible',
    "revealOnReady" BOOLEAN NOT NULL DEFAULT false,
    "allowGrouping" BOOLEAN NOT NULL DEFAULT false,
    "allowCrossColumnGrouping" BOOLEAN NOT NULL DEFAULT false,
    "voting" "VotingMode" NOT NULL DEFAULT 'off',
    "hideVoteCounts" BOOLEAN NOT NULL DEFAULT false,
    "allowReactions" BOOLEAN NOT NULL DEFAULT false,
    "reactionEmojis" TEXT[] DEFAULT ARRAY['👍', '❤️', '🎉', '😮', '😕']::TEXT[],
    "allowPresentation" BOOLEAN NOT NULL DEFAULT false,
    "allowActionItems" BOOLEAN NOT NULL DEFAULT false,
    "showReadyCheck" BOOLEAN NOT NULL DEFAULT true,
    "defaultSort" "CardSort" NOT NULL DEFAULT 'original',
    CONSTRAINT "RetroPhase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetroPhase_retroId_position_idx" ON "RetroPhase"("retroId", "position");
ALTER TABLE "RetroPhase" ADD CONSTRAINT "RetroPhase_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RetroPhaseHiddenColumn
CREATE TABLE "RetroPhaseHiddenColumn" (
    "retroPhaseId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    CONSTRAINT "RetroPhaseHiddenColumn_pkey" PRIMARY KEY ("retroPhaseId","columnId")
);
ALTER TABLE "RetroPhaseHiddenColumn" ADD CONSTRAINT "RetroPhaseHiddenColumn_retroPhaseId_fkey" FOREIGN KEY ("retroPhaseId") REFERENCES "RetroPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroPhaseHiddenColumn" ADD CONSTRAINT "RetroPhaseHiddenColumn_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RetroColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Helper: snapshot classic phases for each existing retro
-- comments
INSERT INTO "RetroPhase" (
  "id", "retroId", "position", "sourcePhaseId", "name", "description", "kind", "icon", "instructions",
  "allowCreateCards", "cardContent", "allowEditOwnCards", "othersVisibility", "allowGrouping",
  "voting", "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
)
SELECT
  'rp_' || r."id" || '_comments', r."id", 0, 'sys_phase_comments',
  'Comentarios', 'Escribir sin ver lo que ponen los demás', 'board', '💬',
  'Escribí tus ideas. Los demás no las ven todavía.',
  true, 'text_and_image', true, 'hidden', false,
  'off', false, false, true, 'original'
FROM "Retrospective" r;

INSERT INTO "RetroPhase" (
  "id", "retroId", "position", "sourcePhaseId", "name", "description", "kind", "icon", "instructions",
  "allowCreateCards", "cardContent", "allowEditOwnCards", "othersVisibility", "allowGrouping",
  "voting", "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
)
SELECT
  'rp_' || r."id" || '_grouping', r."id", 1, 'sys_phase_grouping',
  'Agrupar', 'Agrupar tarjetas similares', 'board', '🗂',
  'Agrupá las ideas que van juntas.',
  true, 'text_and_image', true, 'visible', true,
  'off', false, false, true, 'original'
FROM "Retrospective" r;

INSERT INTO "RetroPhase" (
  "id", "retroId", "position", "sourcePhaseId", "name", "description", "kind", "icon", "instructions",
  "allowCreateCards", "cardContent", "allowEditOwnCards", "othersVisibility", "allowGrouping",
  "voting", "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
)
SELECT
  'rp_' || r."id" || '_voting', r."id", 2, 'sys_phase_voting',
  'Votar', 'Votar las ideas más importantes', 'board', '👍',
  'Distribuí tus votos entre las ideas.',
  false, 'text_and_image', false, 'visible', false,
  'multi', false, false, true, 'original'
FROM "Retrospective" r;

INSERT INTO "RetroPhase" (
  "id", "retroId", "position", "sourcePhaseId", "name", "description", "kind", "icon", "instructions",
  "allowCreateCards", "cardContent", "allowEditOwnCards", "othersVisibility", "allowGrouping",
  "voting", "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
)
SELECT
  'rp_' || r."id" || '_actions', r."id", 3, 'sys_phase_actions',
  'Plan de acción', 'Definir accionables a partir de los temas', 'action_plan', '✅',
  'Definí qué vamos a hacer con lo más votado.',
  false, 'text_and_image', false, 'visible', false,
  'off', true, true, false, 'most_voted'
FROM "Retrospective" r;

INSERT INTO "RetroPhase" (
  "id", "retroId", "position", "sourcePhaseId", "name", "description", "kind", "icon", "instructions",
  "allowCreateCards", "cardContent", "allowEditOwnCards", "othersVisibility", "allowGrouping",
  "voting", "allowPresentation", "allowActionItems", "showReadyCheck", "defaultSort"
)
SELECT
  'rp_' || r."id" || '_roti', r."id", 4, 'sys_phase_roti',
  'ROTI', 'Return on Time Invested', 'roti', '⭐',
  '¿Valió la pena el tiempo invertido?',
  false, 'text_and_image', false, 'visible', false,
  'off', false, false, false, 'original'
FROM "Retrospective" r;

-- Add currentPhaseId to Retrospective and wire it
ALTER TABLE "Retrospective" ADD COLUMN "currentPhaseId" TEXT;

UPDATE "Retrospective" r
SET "currentPhaseId" = CASE
  WHEN r."status"::text = 'comments' THEN 'rp_' || r."id" || '_comments'
  WHEN r."status"::text = 'grouping' THEN 'rp_' || r."id" || '_grouping'
  WHEN r."status"::text = 'voting' THEN 'rp_' || r."id" || '_voting'
  WHEN r."status"::text = 'actions' THEN 'rp_' || r."id" || '_actions'
  WHEN r."status"::text = 'roti' THEN 'rp_' || r."id" || '_roti'
  WHEN r."status"::text = 'closed' THEN 'rp_' || r."id" || '_roti'
  ELSE 'rp_' || r."id" || '_comments'
END;

CREATE UNIQUE INDEX "Retrospective_currentPhaseId_key" ON "Retrospective"("currentPhaseId");
ALTER TABLE "Retrospective" ADD CONSTRAINT "Retrospective_currentPhaseId_fkey" FOREIGN KEY ("currentPhaseId") REFERENCES "RetroPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop status
ALTER TABLE "Retrospective" DROP COLUMN "status";
DROP TYPE "RetroStatus";

-- Card.createdInPhaseId
ALTER TABLE "Card" ADD COLUMN "createdInPhaseId" TEXT;
ALTER TABLE "Card" ADD CONSTRAINT "Card_createdInPhaseId_fkey" FOREIGN KEY ("createdInPhaseId") REFERENCES "RetroPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Participant.semaforoReady
ALTER TABLE "Participant" ADD COLUMN "semaforoReady" BOOLEAN NOT NULL DEFAULT false;

-- CardReaction
CREATE TABLE "CardReaction" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    CONSTRAINT "CardReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardReaction_cardId_participantId_emoji_key" ON "CardReaction"("cardId", "participantId", "emoji");
CREATE INDEX "CardReaction_retroId_idx" ON "CardReaction"("retroId");
ALTER TABLE "CardReaction" ADD CONSTRAINT "CardReaction_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReaction" ADD CONSTRAINT "CardReaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardReaction" ADD CONSTRAINT "CardReaction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RetroSemaforoItem + SemaforoVote
CREATE TABLE "RetroSemaforoItem" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "RetroSemaforoItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RetroSemaforoItem" ADD CONSTRAINT "RetroSemaforoItem_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SemaforoVote" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "value" "SemaforoValue" NOT NULL,
    CONSTRAINT "SemaforoVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SemaforoVote_itemId_participantId_key" ON "SemaforoVote"("itemId", "participantId");
CREATE INDEX "SemaforoVote_retroId_idx" ON "SemaforoVote"("retroId");
ALTER TABLE "SemaforoVote" ADD CONSTRAINT "SemaforoVote_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retrospective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemaforoVote" ADD CONSTRAINT "SemaforoVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RetroSemaforoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SemaforoVote" ADD CONSTRAINT "SemaforoVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
