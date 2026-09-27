-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: default channels used to be recognised by name. Flag the original
-- General and Random (the oldest channel with each name) so existing installs
-- keep auto-joining new users to them; later rooms that merely reuse the name
-- stay invite-only.
UPDATE "Room" SET "isDefault" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("name") "id"
  FROM "Room"
  WHERE "type" = 'CHANNEL' AND "name" IN ('General', 'Random')
  ORDER BY "name", "createdAt" ASC
);
