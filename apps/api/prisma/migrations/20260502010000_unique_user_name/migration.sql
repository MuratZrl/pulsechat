-- Resolve duplicate names by appending a numeric suffix to all but the oldest.
-- Case-insensitive (LOWER) because the mention regex is case-insensitive,
-- so "Alex" and "alex" would still collide on lookup.
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY "createdAt" ASC) AS rn
  FROM "User"
)
UPDATE "User"
SET name = "User".name || '_' || ranked.rn
FROM ranked
WHERE "User".id = ranked.id AND ranked.rn > 1;

-- CreateIndex
-- Functional index on LOWER(name) so the constraint is case-insensitive,
-- matching the case-insensitive mention lookup in messages.service.ts.
-- Without LOWER(), "Alex" and "alex" could both pass the unique check yet
-- both match a single @alex mention — defeating the whole point of the
-- constraint.
CREATE UNIQUE INDEX "User_name_key" ON "User" (LOWER(name));
