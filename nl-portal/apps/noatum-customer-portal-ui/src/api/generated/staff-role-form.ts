// Generated from the API OpenAPI StaffRoleUpdateDto. Do not edit.
import { z } from 'zod';

export const staffRoleFormSchema = z.strictObject({
  "roleKeys": z.array(z.enum(["platform_admin","customer_success","pricing","pricing_approver","ops"])).max(5).refine((values) => new Set(values).size === values.length),
  "branchId": z.string().trim().nullable(),
  "updatedAt": z.iso.datetime(),
  "reason": z.string().trim().min(1).max(400),
});
