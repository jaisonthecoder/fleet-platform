-- Reverses 20261011000000_quote_equipment.
--
-- Dropping the table destroys what the customer asked for, so this is a
-- development and rehearsal tool. Export quote_equipment first anywhere a
-- customer has submitted a full-container request.

DROP POLICY IF EXISTS quote_equipment_tenant_isolation ON quote_equipment;
DROP TABLE IF EXISTS quote_equipment;

ALTER TABLE quote DROP COLUMN IF EXISTS load_type;

UPDATE lookup_item i
SET metadata = NULL
FROM lookup_category c
WHERE c.code = 'container_type' AND i.category_id = c.id;
