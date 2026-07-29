INSERT INTO fleet.lookup_type
  (code, label_en, label_ar, is_hierarchical, is_system)
VALUES
  ('vehicle-acquisition-scenario', 'Acquisition Scenario', 'سيناريو الاقتناء', false, true),
  ('vehicle-operational-status', 'Vehicle Operational Status', 'الحالة التشغيلية للمركبة', false, true),
  ('vehicle-telematics-setup', 'Telematics Setup', 'إعداد التتبع عن بُعد', false, true),
  ('currency', 'Currency', 'العملة', false, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, description_en, description_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.description_en, v.description_ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('vehicle-acquisition-scenario', 'LEASED', 'Leased', 'مؤجرة', 'Vendor lease; contract and commercial terms are required.', 'عقد تأجير من مورد؛ يلزم العقد والشروط التجارية.', 0),
  ('vehicle-acquisition-scenario', 'OWNED_NEW', 'Owned - new purchase', 'مملوكة - شراء جديد', 'Purchased vehicle; purchase reference and value are required.', 'مركبة مشتراة؛ يلزم مرجع الشراء والقيمة.', 1),
  ('vehicle-acquisition-scenario', 'TRANSFER_IN', 'Transfer-in', 'نقل وارد', 'Existing vehicle transferred from another governed node.', 'مركبة قائمة منقولة من عقدة أخرى خاضعة للحوكمة.', 2),
  ('vehicle-acquisition-scenario', 'LEASE_REPLACEMENT', 'Lease replacement', 'استبدال مركبة مؤجرة', 'Replacement linked to an existing lease and off-hire case.', 'استبدال مرتبط بعقد تأجير وحالة إخراج من الخدمة.', 3),
  ('vehicle-operational-status', 'ACTIVE', 'Active', 'نشطة', 'Ready for normal operations after activation gates pass.', 'جاهزة للعمليات العادية بعد اجتياز بوابات التفعيل.', 0),
  ('vehicle-operational-status', 'RESERVE', 'Reserve', 'احتياطية', 'Held as reserve fleet capacity.', 'محتفظ بها كقدرة احتياطية للأسطول.', 1),
  ('vehicle-operational-status', 'STANDBY', 'Standby', 'استعداد', 'Available for controlled standby use.', 'متاحة للاستخدام المنضبط عند الاستعداد.', 2),
  ('vehicle-operational-status', 'VIP_ONLY', 'VIP only', 'لكبار الشخصيات فقط', 'Restricted to approved VIP use.', 'مقيدة لاستخدام كبار الشخصيات المعتمد.', 3),
  ('vehicle-operational-status', 'QUARANTINED', 'Quarantined', 'قيد العزل', 'Blocked from operations pending remediation.', 'محظورة من التشغيل لحين المعالجة.', 4),
  ('vehicle-telematics-setup', 'INSTALL', 'Install telematics unit', 'تركيب جهاز تتبع', 'Schedule a governed telematics installation.', 'جدولة تركيب جهاز تتبع خاضع للحوكمة.', 0),
  ('vehicle-telematics-setup', 'EXISTING', 'Unit already fitted', 'الجهاز مركب مسبقاً', 'Register and verify an existing unit.', 'تسجيل جهاز موجود والتحقق منه.', 1),
  ('vehicle-telematics-setup', 'MANUAL', 'No telematics - manual odometer', 'بدون تتبع - عداد يدوي', 'Use governed manual odometer capture.', 'استخدام إدخال عداد المسافة اليدوي الخاضع للحوكمة.', 2),
  ('currency', 'AED', 'UAE Dirham', 'درهم إماراتي', null, null, 0)
) AS v(type_code, code, en, ar, description_en, description_ar, ord)
  ON v.type_code = t.code
ON CONFLICT (lookup_type_id, code) DO NOTHING;