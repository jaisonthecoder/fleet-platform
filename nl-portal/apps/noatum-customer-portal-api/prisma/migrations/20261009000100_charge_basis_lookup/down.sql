-- Reverses 20261009000100_charge_basis_lookup.
--
-- Charge lines already priced keep their basis: the column is free text and was
-- never a foreign key. Staff lose the dropdown and type it again.

DELETE FROM lookup_item_translation
WHERE item_id IN (
  SELECT i.id FROM lookup_item i
  JOIN lookup_category c ON c.id = i.category_id
  WHERE c.code = 'charge_basis'
);

DELETE FROM lookup_item
WHERE category_id IN (SELECT id FROM lookup_category WHERE code = 'charge_basis');

DELETE FROM lookup_category WHERE code = 'charge_basis';
