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
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
