-- Reverses 20261010000100_dangerous_goods_corrections.

UPDATE lookup_category
SET ownership = 'portal',
    description = 'Degree of danger within a class. Not every dangerous good has one.'
WHERE code = 'dg_packing_group';

COMMENT ON TABLE quote_dangerous_goods IS
  'Dangerous goods data captured with a quote request. NOT a dangerous goods declaration: the declaration is the shipper''s signed certification and CargoWise owns it.';
