-- Dev seed: a minimal hierarchy (Cluster→Pool→Location), a person, and role
-- assignments so /me, the Scope Switcher and SoD-01 integration can run.
-- Idempotent (ON CONFLICT / WHERE NOT EXISTS). Local dev only.

-- Hierarchy: Group → Ports (Cluster) → Khalifa Port (Pool) → Kezad 280 (Location)
INSERT INTO fleet.hierarchy_node (id, parent_id, code, level_index, level_label, level_code, name, name_ar, path)
VALUES
  ('a0000000-0000-4000-8000-000000000001', NULL, 'ADPORTS', 0, 'Group', 'GROUP', 'AD Ports Group', 'مجموعة موانئ أبوظبي', 'group'),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'PORTS', 1, 'Cluster', 'CLUSTER', 'Ports', 'الموانئ', 'group.ports'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'PORTS-KHALIFA', 2, 'Pool', 'POOL', 'Khalifa Port Pool', 'مجمع ميناء خليفة', 'group.ports.khalifa'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'LOC-KEZAD-280', 3, 'Location', 'LOCATION', 'Kezad 280', 'كيزاد ٢٨٠', 'group.ports.khalifa.kezad280')
ON CONFLICT (id) DO UPDATE SET
  parent_id = EXCLUDED.parent_id,
  code = EXCLUDED.code,
  level_index = EXCLUDED.level_index,
  level_label = EXCLUDED.level_label,
  level_code = EXCLUDED.level_code,
  name = EXCLUDED.name,
  name_ar = EXCLUDED.name_ar,
  path = EXCLUDED.path,
  updated_at_utc = now();

-- People: an employee and their line manager.
INSERT INTO fleet.person (id, hcm_employee_id, full_name, email, grade, employment_status, home_pool_node_id, line_manager_person_id)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'EMP-1001', 'Aisha Rahman', 'aisha@example.ae', 'G3', 'Active', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'EMP-1002', 'Omar Farouk', 'omar@example.ae', 'M2', 'Active', 'a0000000-0000-4000-8000-000000000003', NULL)
ON CONFLICT (id) DO NOTHING;

-- Roles: the employee books; the manager approves at the pool scope.
INSERT INTO fleet.role_assignment (id, person_id, role, scope_node_id)
VALUES
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Employee', 'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Approver', 'a0000000-0000-4000-8000-000000000003')
ON CONFLICT (person_id, role, scope_node_id) DO NOTHING;

-- Full role roster (dev-login): one dummy user per remaining business role, each
-- with a proper email, grade, home pool and a single role assignment at a sensible
-- scope (Group / Cluster / Pool). Lets you sign in as any actor to exercise the
-- role-driven navigation and RBAC. Idempotent.
INSERT INTO fleet.person (id, hcm_employee_id, full_name, email, grade, employment_status, home_pool_node_id)
VALUES
  ('b0000000-0000-4000-8000-000000000003', 'EMP-1003', 'Huda Kamal',          'huda@example.ae',        'M2', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000004', 'EMP-1004', 'Khalid Rashed',       'khalid@example.ae',      'M2', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000005', 'EMP-1005', 'Mariam Saeed',        'mariam@example.ae',      'M3', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000006', 'EMP-1006', 'Hamdan Ali',          'hamdan@example.ae',      'M4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000007', 'EMP-1007', 'Noura Abdullah',      'noura@example.ae',       'E1', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000008', 'EMP-1008', 'Tariq Mansour',       'tariq@example.ae',       'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000009', 'EMP-1009', 'Sara Ibrahim',        'sara@example.ae',        'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000a', 'EMP-1010', 'Ahmed Zayed',         'ahmed@example.ae',       'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000b', 'EMP-1011', 'Layla Hassan',        'layla.h@example.ae',     'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000c', 'EMP-1012', 'Reem Salem',          'reem@example.ae',        'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000d', 'EMP-1013', 'Yousef Al Marzouqi',  'yousef@example.ae',      'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000e', 'EMP-1014', 'Sultan Al Nuaimi',    'sultan@example.ae',      'E1', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-00000000000f', 'EMP-1015', 'Fatima Noor',         'fatima@example.ae',      'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000010', 'EMP-1016', 'Zayed Karim',         'zayed.admin@example.ae', 'G4', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000011', 'EMP-1017', 'Bilal Haddad',        'bilal@example.ae',       'G2', 'Active', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000012', 'EMP-1018', 'Rashed Obaid',        'rashed@example.ae',      'G2', 'Active', 'a0000000-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Scope for each role: Group = a0…001, Cluster = a0…002, Pool = a0…003.
INSERT INTO fleet.role_assignment (id, person_id, role, scope_node_id)
VALUES
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'Delegate',           'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'FleetManager',       'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'ClusterFleetLead',   'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 'GroupFleetLead',     'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000007', 'ClusterCEO',         'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000008', 'Procurement',        'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 'Finance',            'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000a', 'HR',                 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'InsuranceLead',      'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-00000000000c', 'HSE',                'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-00000000000d', 'InternalAudit',      'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000e', 'Executive',          'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-00000000000f', 'DataSteward',        'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', 'SystemAdmin',        'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000011', 'SubstituteDriver',   'a0000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000012', 'ProfessionalDriver', 'a0000000-0000-4000-8000-000000000003')
ON CONFLICT (person_id, role, scope_node_id) DO NOTHING;

-- Reference data (ADR-009): every dropdown sources from lookups. Bilingual EN/AR,
-- code-keyed. `hierarchy-level` is the level taxonomy (nothing FKs a level).
INSERT INTO fleet.lookup_type (code, label_en, label_ar, is_hierarchical, is_system) VALUES
  ('hierarchy-level',  'Hierarchy Level', 'مستوى الهيكل',  false, true),
  ('vehicle-body-type','Body Type',       'نوع الهيكل',    false, true),
  ('use-category',     'Use Category',    'فئة الاستخدام', false, true),
  ('fuel-type',        'Fuel Type',       'نوع الوقود',    false, true),
  ('ownership-type',   'Ownership Type',  'نوع الملكية',   false, true),
  ('vehicle-make',     'Make',            'الصانع',        true,  true)
ON CONFLICT (code) DO NOTHING;

-- Flat value sets (level taxonomy, body type, use category, fuel, ownership).
INSERT INTO fleet.lookup_value (lookup_type_id, code, label_en, label_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('hierarchy-level','GROUP','Group','مجموعة',0),
  ('hierarchy-level','CLUSTER','Cluster','مجموعة فرعية',1),
  ('hierarchy-level','POOL','Pool','مجمع',2),
  ('hierarchy-level','LOCATION','Location','موقع',3),
  ('vehicle-body-type','SEDAN','Sedan','سيدان',0),
  ('vehicle-body-type','SUV','SUV','دفع رباعي',1),
  ('vehicle-body-type','VAN','Van','فان',2),
  ('vehicle-body-type','PICKUP','Pickup','بيك أب',3),
  ('vehicle-body-type','BUS','Bus','حافلة',4),
  ('vehicle-body-type','EQUIPMENT','Equipment','معدات',5),
  ('use-category','EXECUTIVE','Executive','تنفيذي',0),
  ('use-category','OPERATIONS','Operations','عمليات',1),
  ('use-category','POOL','Pool','مجمع',2),
  ('use-category','VIP','VIP','كبار الشخصيات',3),
  ('use-category','DEDICATED','Dedicated','مخصص',4),
  ('fuel-type','PETROL','Petrol','بنزين',0),
  ('fuel-type','DIESEL','Diesel','ديزل',1),
  ('fuel-type','HYBRID','Hybrid','هجين',2),
  ('fuel-type','EV','Electric','كهرباء',3),
  ('ownership-type','OWNED','Owned','مملوكة',0),
  ('ownership-type','LEASED','Leased','مؤجرة',1)
) AS v(type_code, code, en, ar, ord) ON v.type_code = t.code
ON CONFLICT (lookup_type_id, code) DO NOTHING;

-- Makes (parents).
INSERT INTO fleet.lookup_value (lookup_type_id, code, label_en, label_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('TOYOTA','Toyota','تويوتا',0),
  ('NISSAN','Nissan','نيسان',1),
  ('MITSUBISHI','Mitsubishi','ميتسوبيشي',2)
) AS v(code, en, ar, ord) ON TRUE
WHERE t.code = 'vehicle-make'
ON CONFLICT (lookup_type_id, code) DO NOTHING;

-- Models (children of a make — cascading dropdown).
INSERT INTO fleet.lookup_value (lookup_type_id, code, label_en, label_ar, parent_id, sort_order)
SELECT t.id, m.code, m.en, m.ar, p.id, m.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('LANDCRUISER','Land Cruiser','لاند كروزر','TOYOTA',0),
  ('HILUX','Hilux','هايلوكس','TOYOTA',1),
  ('PATROL','Patrol','باترول','NISSAN',0),
  ('PAJERO','Pajero','باجيرو','MITSUBISHI',0)
) AS m(code, en, ar, make, ord) ON TRUE
JOIN fleet.lookup_value p ON p.lookup_type_id = t.id AND p.code = m.make
WHERE t.code = 'vehicle-make'
ON CONFLICT (lookup_type_id, code) DO NOTHING;
