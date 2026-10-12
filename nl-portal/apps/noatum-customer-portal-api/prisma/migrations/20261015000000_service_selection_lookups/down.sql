-- Reverses 20261015000000_service_selection_lookups.
--
-- The items and categories are left in place: they predate this migration (the
-- seed script creates them) and dropping them would take the load type off every
-- quote that already references it. Only what this migration added is removed.

UPDATE lookup_item i
SET metadata = i.metadata - 'modes'
FROM lookup_category c
WHERE c.id = i.category_id AND c.code = 'load_type';

UPDATE lookup_item_translation t
SET description = NULL
FROM lookup_item i
JOIN lookup_category c ON c.id = i.category_id
WHERE t.item_id = i.id AND c.code IN ('transport_mode', 'load_type');
