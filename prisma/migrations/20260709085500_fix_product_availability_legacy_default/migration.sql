-- Normalize legacy products that were created before availability tracking rollout.
-- These rows may have been shown as out of stock due to historical fallback behavior.
-- We only update products created before the availability feature migration timestamp.
UPDATE "Product"
SET "isAvailable" = true
WHERE "isActive" = true
  AND "isAvailable" = false
  AND "createdAt" < TIMESTAMPTZ '2026-07-09 08:12:00+00';
