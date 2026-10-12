-- Reverses 20261012000000_quote_special_handling.
--
-- Dropping these destroys what the customer told us about their cargo, so this
-- is a development and rehearsal tool. Export both tables first anywhere a
-- customer has submitted a temperature-controlled or out-of-gauge request.

DROP POLICY IF EXISTS quote_temperature_control_tenant_isolation ON quote_temperature_control;
DROP POLICY IF EXISTS quote_oversize_item_tenant_isolation ON quote_oversize_item;
DROP TABLE IF EXISTS quote_temperature_control;
DROP TABLE IF EXISTS quote_oversize_item;

DELETE FROM lookup_item_translation
WHERE item_id IN (
  SELECT i.id FROM lookup_item i
  JOIN lookup_category c ON c.id = i.category_id
  WHERE c.code IN ('reefer_ventilation', 'reefer_data_logger', 'lifting_method')
);

DELETE FROM lookup_item
WHERE category_id IN (
  SELECT id FROM lookup_category
  WHERE code IN ('reefer_ventilation', 'reefer_data_logger', 'lifting_method')
);

DELETE FROM lookup_category
WHERE code IN ('reefer_ventilation', 'reefer_data_logger', 'lifting_method');
