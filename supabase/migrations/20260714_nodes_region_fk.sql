-- ═══════════════════════════════════════════════════════════
-- Migration: Replace nodes.region (slug text) with FK region_id
--
-- Problem:  nodes.region stored raw slugs (e.g. 'SEA-01').
--           No referential integrity. UI displayed slug, not name.
--
-- Solution: Add region_id UUID FK → regions(id).
--           Backfill from slug match. Drop old text column.
--
-- Pattern:  Normalized relational data + proper FK constraint.
--
-- IMPORTANT: Run this in your Supabase SQL Editor.
--            Safe to run multiple times (IF NOT EXISTS guards).
-- ═══════════════════════════════════════════════════════════

-- Step 1: Ensure an UNKNOWN fallback region exists for orphaned nodes
-- (nodes whose slug doesn't match any row in regions)
INSERT INTO regions (slug, name)
VALUES ('UNKNOWN', 'Unknown Region')
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Add the new FK column (nullable first — required for backfill)
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- Step 3: Backfill region_id from matching slug in regions table
UPDATE nodes n
SET region_id = r.id
FROM regions r
WHERE r.slug = n.region
  AND n.region_id IS NULL;

-- Step 4: For any nodes that didn't match a slug, assign UNKNOWN region
UPDATE nodes n
SET region_id = r.id
FROM regions r
WHERE r.slug = 'UNKNOWN'
  AND n.region_id IS NULL;

-- Step 5: Now enforce NOT NULL
ALTER TABLE nodes
  ALTER COLUMN region_id SET NOT NULL;

-- Step 6: Drop the old denormalized text column
ALTER TABLE nodes
  DROP COLUMN IF EXISTS region;

-- Step 7: Index for efficient region-based lookups
CREATE INDEX IF NOT EXISTS idx_nodes_region_id ON nodes(region_id);

-- Step 8: Column documentation
COMMENT ON COLUMN nodes.region_id IS 'FK to regions.id. Replaces the old denormalized region slug text column.';
