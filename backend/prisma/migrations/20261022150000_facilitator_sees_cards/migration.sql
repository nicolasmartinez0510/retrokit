-- Hidden or blurred cards stay concealed for the facilitator unless the phase says otherwise.
ALTER TABLE "Phase" ADD COLUMN "facilitatorSeesCards" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RetroPhase" ADD COLUMN "facilitatorSeesCards" BOOLEAN NOT NULL DEFAULT false;
