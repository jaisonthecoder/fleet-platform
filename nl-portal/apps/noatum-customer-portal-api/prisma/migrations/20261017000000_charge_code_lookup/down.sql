-- Reverses 20261017000000_charge_code_lookup.
--
-- Charge lines already priced keep their code: the column is free text and was
-- never a foreign key. Staff lose the list and type it from memory again.

DELETE FROM lookup_item_translation
WHERE item_id IN (
  SELECT i.id FROM lookup_item i
  JOIN lookup_category c ON c.id = i.category_id
  WHERE c.code = 'charge_code'
);

DELETE FROM lookup_item
WHERE category_id IN (SELECT id FROM lookup_category WHERE code = 'charge_code');

DELETE FROM lookup_category WHERE code = 'charge_code';
