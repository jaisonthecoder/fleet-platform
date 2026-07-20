import { z } from 'zod';
import { policyDecisionSchema, policyScopeSchema } from './policy-evaluation.contract';
import { policyRuleTypeSchema } from './policy-rules.contract';

export const decisionOperatorSchema = z.enum([
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'notIn',
]);
export type DecisionOperator = z.infer<typeof decisionOperatorSchema>;

export const factDataTypeSchema = z.enum(['boolean', 'number', 'string', 'enum']);
export type FactDataType = z.infer<typeof factDataTypeSchema>;

export const policyFactDefinitionSchema = z.object({
  key: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  descriptionEn: z.string().min(1),
  descriptionAr: z.string().min(1),
  dataType: factDataTypeSchema,
  operators: z.array(decisionOperatorSchema).min(1),
  unit: z.string().optional(),
  allowedValues: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  source: z.string().min(1),
  nullable: z.boolean().default(false),
  freshnessMinutes: z.number().int().positive().optional(),
  classification: z.enum(['internal', 'personal', 'sensitive']).default('internal'),
});
export type PolicyFactDefinition = z.input<typeof policyFactDefinitionSchema>;

export const authoredConditionSchema = z.object({
  id: z.string().min(1),
  fact: z.string().min(1),
  operator: decisionOperatorSchema,
  value: z.unknown(),
});
export type AuthoredCondition = z.infer<typeof authoredConditionSchema>;

export const authoredDecisionRowSchema = z.object({
  id: z.string().min(1),
  conditions: z.array(authoredConditionSchema).min(1),
  decision: policyDecisionSchema,
  reasons: z.array(z.string().min(1)).min(1),
  route: z.array(z.string().min(1)).optional(),
  value: z.unknown().optional(),
});
export type AuthoredDecisionRow = z.infer<typeof authoredDecisionRowSchema>;

export const authoredDecisionDefaultSchema = z.object({
  decision: policyDecisionSchema,
  reasons: z.array(z.string().min(1)).min(1),
  route: z.array(z.string().min(1)).optional(),
  value: z.unknown().optional(),
});

export const authoredDecisionTableSchema = z.object({
  schemaVersion: z.literal(1),
  ruleType: policyRuleTypeSchema,
  version: z.string().min(1),
  scope: policyScopeSchema,
  rows: z.array(authoredDecisionRowSchema).max(100),
  default: authoredDecisionDefaultSchema,
});
export type AuthoredDecisionTable = z.infer<typeof authoredDecisionTableSchema>;

export const policySimulationRequestSchema = z.object({
  table: authoredDecisionTableSchema,
  context: z.record(z.string(), z.unknown()),
});

export const savePolicyDraftSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  scopeNodeId: z.string().uuid().nullable().optional(),
  table: authoredDecisionTableSchema,
});

export const policyCatalogItemSchema = z.object({
  ruleType: policyRuleTypeSchema,
  activeVersion: z.string().nullable(),
  draftRevision: z.number().int().positive().nullable(),
  status: z.enum(['Configured', 'Draft']),
});
export type PolicyCatalogItem = z.infer<typeof policyCatalogItemSchema>;

export const policySimulationResponseSchema = z.object({
  decision: policyDecisionSchema,
  reasons: z.array(z.string()),
  policyVersion: z.string(),
  scopeThatAnswered: policyScopeSchema,
  matchedRowId: z.string().nullable(),
  route: z.array(z.string()).optional(),
  value: z.unknown().optional(),
});
export type PolicySimulationResponse = z.infer<typeof policySimulationResponseSchema>;

/** Metadata exposed to the policy studio; stable keys are also runtime context keys. */
export const POLICY_FACT_CATALOG: PolicyFactDefinition[] = [
  { key: 'vehicleClass', labelEn: 'Vehicle class', labelAr: 'فئة المركبة', descriptionEn: 'Operational class of the requested vehicle.', descriptionAr: 'الفئة التشغيلية للمركبة المطلوبة.', dataType: 'enum', operators: ['eq', 'neq', 'in', 'notIn'], allowedValues: ['pool', 'executive'], source: 'vehicle-master' },
  { key: 'durationHours', labelEn: 'Booking duration', labelAr: 'مدة الحجز', descriptionEn: 'Requested booking duration in hours.', descriptionAr: 'مدة الحجز المطلوبة بالساعات.', dataType: 'number', operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'notIn'], unit: 'hours', source: 'booking-request' },
  { key: 'bookingLeadTimeDays', labelEn: 'Booking lead time', labelAr: 'مدة الحجز المسبقة', descriptionEn: 'Days between the request and pickup.', descriptionAr: 'عدد الأيام بين الطلب وموعد الاستلام.', dataType: 'number', operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'], unit: 'days', source: 'booking-request' },
  { key: 'concurrentBookings', labelEn: 'Concurrent bookings', labelAr: 'الحجوزات المتزامنة', descriptionEn: 'Number of overlapping active bookings for the driver.', descriptionAr: 'عدد الحجوزات النشطة المتداخلة للسائق.', dataType: 'number', operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'], source: 'booking' },
  { key: 'driverLicenceStatus', labelEn: 'Driver licence status', labelAr: 'حالة رخصة السائق', descriptionEn: 'Current verified licence status.', descriptionAr: 'الحالة الحالية المتحققة لرخصة السائق.', dataType: 'enum', operators: ['eq', 'neq', 'in', 'notIn'], allowedValues: ['VALID', 'EXPIRED', 'SUSPENDED'], source: 'hcm', freshnessMinutes: 1440, classification: 'personal' },
  { key: 'eligible', labelEn: 'Driver eligible', labelAr: 'السائق مؤهل', descriptionEn: 'Upstream eligibility fact.', descriptionAr: 'حقيقة الأهلية من المصدر.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'compliance' },
  { key: 'requestType', labelEn: 'Request type', labelAr: 'نوع الطلب', descriptionEn: 'Entitlement request category.', descriptionAr: 'فئة طلب الاستحقاق.', dataType: 'enum', operators: ['eq', 'neq', 'in', 'notIn'], allowedValues: ['temporary', 'permanent'], source: 'entitlement-request' },
  { key: 'gradeEligible', labelEn: 'Grade eligible', labelAr: 'الدرجة مؤهلة', descriptionEn: 'Whether the employee grade is eligible.', descriptionAr: 'ما إذا كانت درجة الموظف مؤهلة.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'hcm', freshnessMinutes: 1440, classification: 'personal' },
  { key: 'licenceValid', labelEn: 'Licence valid', labelAr: 'الرخصة سارية', descriptionEn: 'Verified driver licence validity.', descriptionAr: 'صلاحية رخصة السائق المتحققة.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'hcm', freshnessMinutes: 1440, classification: 'personal' },
  { key: 'notBlocked', labelEn: 'No active block', labelAr: 'لا يوجد حظر نشط', descriptionEn: 'Driver has no active access block.', descriptionAr: 'لا يوجد حظر وصول نشط على السائق.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'compliance', classification: 'personal' },
  { key: 'vehicleDocsValid', labelEn: 'Vehicle documents valid', labelAr: 'وثائق المركبة سارية', descriptionEn: 'Required vehicle documents are valid.', descriptionAr: 'وثائق المركبة المطلوبة سارية.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'vehicle-master' },
  { key: 'itemType', labelEn: 'Compliance item type', labelAr: 'نوع عنصر الامتثال', descriptionEn: 'Compliance document or obligation type.', descriptionAr: 'نوع وثيقة أو التزام الامتثال.', dataType: 'enum', operators: ['eq', 'neq', 'in', 'notIn'], allowedValues: ['insurance', 'registration', 'licence'], source: 'compliance' },
  { key: 'registrationExpired', labelEn: 'Registration expired', labelAr: 'انتهاء تسجيل المركبة', descriptionEn: 'Vehicle registration has expired.', descriptionAr: 'انتهى تسجيل المركبة.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'vehicle-master' },
  { key: 'insuranceExpired', labelEn: 'Insurance expired', labelAr: 'انتهاء التأمين', descriptionEn: 'Vehicle insurance has expired.', descriptionAr: 'انتهى تأمين المركبة.', dataType: 'boolean', operators: ['eq', 'neq'], allowedValues: [true, false], source: 'vehicle-master' },
  { key: 'finesInWindow', labelEn: 'Fines in period', labelAr: 'المخالفات في الفترة', descriptionEn: 'Attributed fines in the configured period.', descriptionAr: 'المخالفات المنسوبة خلال الفترة المحددة.', dataType: 'number', operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'], source: 'fines', classification: 'personal' },
  { key: 'jurisdiction', labelEn: 'Jurisdiction', labelAr: 'الاختصاص', descriptionEn: 'Traffic authority jurisdiction.', descriptionAr: 'اختصاص جهة المرور.', dataType: 'string', operators: ['eq', 'neq', 'in', 'notIn'], source: 'fine-event' },
  { key: 'changeType', labelEn: 'Booking change type', labelAr: 'نوع تغيير الحجز', descriptionEn: 'Category of booking modification.', descriptionAr: 'فئة تعديل الحجز.', dataType: 'string', operators: ['eq', 'neq', 'in', 'notIn'], source: 'booking' },
  { key: 'deviationPercent', labelEn: 'Fuel deviation', labelAr: 'انحراف الوقود', descriptionEn: 'Observed fuel deviation percentage.', descriptionAr: 'نسبة انحراف الوقود المرصودة.', dataType: 'number', operators: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'], unit: 'percent', source: 'handover' },
];
