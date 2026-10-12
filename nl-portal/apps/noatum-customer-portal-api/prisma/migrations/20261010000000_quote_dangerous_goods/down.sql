-- Reverses 20261010000000_quote_dangerous_goods.
--
-- Dropping the table destroys captured hazard data, so this is a development
-- and rehearsal tool. Anywhere a customer has submitted a DG request, export
-- quote_dangerous_goods before running it.

DROP POLICY IF EXISTS quote_dangerous_goods_tenant_isolation ON quote_dangerous_goods;
DROP TABLE IF EXISTS quote_dangerous_goods;

DELETE FROM lookup_item_translation
WHERE item_id IN (
  SELECT i.id FROM lookup_item i
  JOIN lookup_category c ON c.id = i.category_id
  WHERE c.code IN ('dg_packing_group', 'dg_packaging_type', 'dg_transport_regime', 'dg_quantity_unit')
);

DELETE FROM lookup_item
WHERE category_id IN (
  SELECT id FROM lookup_category
  WHERE code IN ('dg_packing_group', 'dg_packaging_type', 'dg_transport_regime', 'dg_quantity_unit')
);

DELETE FROM lookup_category
WHERE code IN ('dg_packing_group', 'dg_packaging_type', 'dg_transport_regime', 'dg_quantity_unit');
