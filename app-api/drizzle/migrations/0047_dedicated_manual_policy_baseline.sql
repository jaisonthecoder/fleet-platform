INSERT INTO fleet.lookup_type
  (code, label_en, label_ar, description_en, description_ar, is_hierarchical, is_system)
VALUES
  (
    'dedicated-vehicle-justification-category',
    'Dedicated Vehicle Justification Category',
    'فئة مبرر المركبة المخصصة',
    'Manually governed reasons available on Dedicated Vehicle requests.',
    'أسباب خاضعة للحوكمة ومتاحة لطلبات المركبات المخصصة.',
    false,
    true
  ),
  (
    'dedicated-vehicle-class',
    'Dedicated Vehicle Class',
    'فئة المركبة المخصصة',
    'Vehicle body classes that an eligibility policy may permit.',
    'فئات هيكل المركبات التي قد تسمح بها سياسة الأهلية.',
    false,
    true
  )
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, description_en, description_ar, sort_order, metadata)
SELECT type.id, value.code, value.label_en, value.label_ar,
  value.description_en, value.description_ar, value.sort_order, value.metadata::jsonb
FROM fleet.lookup_type type
JOIN (VALUES
  (
    'dedicated-vehicle-justification-category',
    'OPERATIONAL_REQUIREMENT',
    'Operational requirement',
    'متطلب تشغيلي',
    'Frequent or sustained travel required by the employee role.',
    'تنقل متكرر أو مستمر تتطلبه وظيفة الموظف.',
    0,
    '{"allowedRequestTypes":["LongTerm","Temporary"],"supportingEvidenceRequired":false}'
  ),
  (
    'dedicated-vehicle-justification-category',
    'ROLE_REQUIREMENT',
    'Role requirement',
    'متطلب وظيفي',
    'A documented role responsibility requires dedicated mobility.',
    'تتطلب مسؤولية وظيفية موثقة وسيلة تنقل مخصصة.',
    1,
    '{"allowedRequestTypes":["LongTerm","Temporary"],"supportingEvidenceRequired":true}'
  ),
  (
    'dedicated-vehicle-justification-category',
    'TEMPORARY_PROJECT',
    'Temporary project assignment',
    'تكليف مشروع مؤقت',
    'A time-bounded project requires regular travel between operational sites.',
    'يتطلب مشروع محدد المدة تنقلاً منتظماً بين المواقع التشغيلية.',
    2,
    '{"allowedRequestTypes":["Temporary"],"supportingEvidenceRequired":true}'
  ),
  (
    'dedicated-vehicle-justification-category',
    'ACCESSIBILITY_ACCOMMODATION',
    'Accessibility accommodation',
    'ترتيبات تيسيرية للوصول',
    'An approved workplace accommodation requires suitable transport.',
    'تتطلب ترتيبات تيسيرية معتمدة في مكان العمل وسيلة نقل مناسبة.',
    3,
    '{"allowedRequestTypes":["LongTerm","Temporary"],"supportingEvidenceRequired":true,"sensitive":true}'
  ),
  (
    'dedicated-vehicle-class',
    'SEDAN',
    'Sedan',
    'سيدان',
    'Standard passenger sedan.',
    'مركبة سيدان قياسية للركاب.',
    0,
    '{}'
  ),
  (
    'dedicated-vehicle-class',
    'SUV',
    'SUV',
    'دفع رباعي',
    'Sport utility vehicle.',
    'مركبة رياضية متعددة الاستخدامات.',
    1,
    '{}'
  )
) AS value(type_code, code, label_en, label_ar, description_en, description_ar, sort_order, metadata)
  ON type.code = value.type_code
ON CONFLICT (lookup_type_id, code) DO NOTHING;
--> statement-breakpoint
DO $$
DECLARE
  rule_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM fleet.policy_rule
    WHERE organization_id = '00000000-0000-4000-8000-000000000001'
      AND rule_type = 'dedicated-vehicle-eligibility'
      AND scope_node_id IS NULL
      AND status = 'Active'
  ) THEN
    INSERT INTO fleet.policy_rule (
      organization_id,
      rule_type,
      scope_node_id,
      status,
      effective_from,
      created_by,
      approved_by
    ) VALUES (
      '00000000-0000-4000-8000-000000000001',
      'dedicated-vehicle-eligibility',
      NULL,
      'Active',
      now(),
      'migration:0047',
      'application-default'
    ) RETURNING id INTO rule_id;

    INSERT INTO fleet.policy_version (
      policy_rule_id,
      version,
      decision_table,
      input_schema_ref,
      activated_at
    ) VALUES (
      rule_id,
      1,
      '{
        "ruleType":"dedicated-vehicle-eligibility",
        "version":"manual-dedicated-eligibility-v1",
        "scope":"group",
        "rows":[
          {
            "id":"active-g12-plus-long-term",
            "conditions":[
              {"id":"employment","fact":"employmentStatus","operator":"eq","value":"Active"},
              {"id":"driver","fact":"driverOption","operator":"eq","value":"WithoutDriver"},
              {"id":"grade","fact":"grade","operator":"in","value":["G12","G13","G14","G15","Director","Executive"]},
              {"id":"duration","fact":"durationDays","operator":"lte","value":365}
            ],
            "decision":"ALLOW",
            "reasons":["dedicated-manual-policy-eligible"],
            "value":{"permittedVehicleClasses":["SEDAN","SUV"],"maxDurationDays":365}
          },
          {
            "id":"active-temporary-project",
            "conditions":[
              {"id":"employment","fact":"employmentStatus","operator":"eq","value":"Active"},
              {"id":"driver","fact":"driverOption","operator":"eq","value":"WithoutDriver"},
              {"id":"request-type","fact":"requestType","operator":"eq","value":"Temporary"},
              {"id":"justification","fact":"justificationCategory","operator":"eq","value":"TEMPORARY_PROJECT"},
              {"id":"duration","fact":"durationDays","operator":"lte","value":90}
            ],
            "decision":"ALLOW",
            "reasons":["dedicated-temporary-project-eligible"],
            "value":{"permittedVehicleClasses":["SEDAN"],"maxDurationDays":90}
          }
        ],
        "default":{"decision":"DENY","reasons":["dedicated-manual-policy-no-match"]}
      }'::jsonb,
      'policy-rules.contract:dedicatedVehicleEligibilityInput',
      now()
    );
  END IF;
END
$$;