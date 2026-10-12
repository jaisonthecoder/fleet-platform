-- Reverses 20260912070000_lookup_management.
--
-- Safe only while no business record references a lookup item. Once a quote or
-- a booking stores a lookup code, retirement is deactivation and this file is
-- no longer the right tool - use a forward compensating migration instead.

DROP TABLE IF EXISTS "lookup_item_translation";
DROP TABLE IF EXISTS "lookup_item";
DROP TABLE IF EXISTS "lookup_category";
DROP TYPE IF EXISTS "LookupOwnership";
