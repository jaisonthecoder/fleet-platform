-- Reverses 20261009000000_carrier_lookup.
--
-- Removes the maintained carrier list. Nothing on a quote breaks: carrier_name
-- is free text and never a foreign key, so every option keeps the carrier it was
-- priced with. Staff simply lose the dropdown and type the name again.
--
-- Carriers an administrator ADDED by hand after this migration are deleted too.
-- That is unavoidable - they live in the same category - and it is the reason to
-- read this before running it on anything but a scratch database.

DELETE FROM lookup_item_translation
WHERE item_id IN (
  SELECT i.id FROM lookup_item i
  JOIN lookup_category c ON c.id = i.category_id
  WHERE c.code = 'carrier'
);

DELETE FROM lookup_item
WHERE category_id IN (SELECT id FROM lookup_category WHERE code = 'carrier');

DELETE FROM lookup_category WHERE code = 'carrier';
