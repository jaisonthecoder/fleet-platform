INSERT INTO fleet.lookup_type
  (code, label_en, label_ar, is_hierarchical, is_system)
VALUES
  ('vehicle-body-type', 'Body Type', 'نوع الهيكل', false, true),
  ('use-category', 'Use Category', 'فئة الاستخدام', false, true),
  ('fuel-type', 'Fuel Type', 'نوع الوقود', false, true),
  ('ownership-type', 'Ownership Type', 'نوع الملكية', false, true),
  ('vehicle-make', 'Make and Model', 'الصانع والطراز', true, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('vehicle-body-type', 'SEDAN', 'Sedan', 'سيدان', 0),
  ('vehicle-body-type', 'SUV', 'SUV', 'دفع رباعي', 1),
  ('vehicle-body-type', 'VAN', 'Van', 'فان', 2),
  ('vehicle-body-type', 'PICKUP', 'Pickup', 'بيك أب', 3),
  ('vehicle-body-type', 'BUS', 'Bus', 'حافلة', 4),
  ('vehicle-body-type', 'EQUIPMENT', 'Equipment', 'معدات', 5),
  ('use-category', 'EXECUTIVE', 'Executive', 'تنفيذي', 0),
  ('use-category', 'OPERATIONS', 'Operations', 'عمليات', 1),
  ('use-category', 'POOL', 'Pool', 'مجمع', 2),
  ('use-category', 'VIP', 'VIP', 'كبار الشخصيات', 3),
  ('use-category', 'DEDICATED', 'Dedicated', 'مخصص', 4),
  ('fuel-type', 'PETROL', 'Petrol', 'بنزين', 0),
  ('fuel-type', 'DIESEL', 'Diesel', 'ديزل', 1),
  ('fuel-type', 'HYBRID', 'Hybrid', 'هجين', 2),
  ('fuel-type', 'EV', 'Electric', 'كهرباء', 3),
  ('ownership-type', 'OWNED', 'Owned', 'مملوكة', 0),
  ('ownership-type', 'LEASED', 'Leased', 'مؤجرة', 1)
) AS v(type_code, code, en, ar, ord)
  ON v.type_code = t.code
ON CONFLICT (lookup_type_id, code) DO NOTHING;

INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('TOYOTA', 'Toyota', 'تويوتا', 0),
  ('NISSAN', 'Nissan', 'نيسان', 1),
  ('MITSUBISHI', 'Mitsubishi', 'ميتسوبيشي', 2),
  ('KIA', 'Kia', 'كيا', 3)
) AS v(code, en, ar, ord) ON true
WHERE t.code = 'vehicle-make'
ON CONFLICT (lookup_type_id, code) DO NOTHING;

INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, parent_id, sort_order)
SELECT t.id, m.code, m.en, m.ar, p.id, m.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('LANDCRUISER', 'Land Cruiser', 'لاند كروزر', 'TOYOTA', 0),
  ('FORTUNER', 'Fortuner', 'فورتشنر', 'TOYOTA', 1),
  ('HILUX', 'Hilux', 'هايلوكس', 'TOYOTA', 2),
  ('COROLLA', 'Corolla', 'كورولا', 'TOYOTA', 3),
  ('PATROL', 'Patrol', 'باترول', 'NISSAN', 0),
  ('URVAN', 'Urvan', 'أورفان', 'NISSAN', 1),
  ('PAJERO', 'Pajero', 'باجيرو', 'MITSUBISHI', 0),
  ('EV6', 'EV6', 'EV6', 'KIA', 0)
) AS m(code, en, ar, make_code, ord) ON true
JOIN fleet.lookup_value p
  ON p.lookup_type_id = t.id AND p.code = m.make_code
WHERE t.code = 'vehicle-make'
ON CONFLICT (lookup_type_id, code) DO NOTHING;