-- Trait columns must be real (float), not smallint.
-- PR #343 changed embark.ts to generate traits as Math.random() (0.0-1.0 floats),
-- but the original schema used smallint (-3..3). Embark fails with:
--   "invalid input syntax for type smallint: 0.5160..."
ALTER TABLE dwarves
  ALTER COLUMN trait_openness        TYPE real,
  ALTER COLUMN trait_conscientiousness TYPE real,
  ALTER COLUMN trait_extraversion    TYPE real,
  ALTER COLUMN trait_agreeableness   TYPE real,
  ALTER COLUMN trait_neuroticism     TYPE real;
