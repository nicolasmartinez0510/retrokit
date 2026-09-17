-- Customizable display emojis for Semáforo / Analizar semáforo (ordered red, yellow, green).
ALTER TABLE "Phase"
  ADD COLUMN "semaforoEmojis" TEXT[] NOT NULL DEFAULT ARRAY['🔴', '🟡', '🟢']::TEXT[];

ALTER TABLE "RetroPhase"
  ADD COLUMN "semaforoEmojis" TEXT[] NOT NULL DEFAULT ARRAY['🔴', '🟡', '🟢']::TEXT[];
