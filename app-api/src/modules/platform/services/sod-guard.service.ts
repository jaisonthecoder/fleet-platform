import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PlatformRole } from '../../../common/database/schema';
import { evaluateRoleAssignmentSod, evaluateSod, type SodContext } from '../internal/sod-rules';

@Injectable()
export class SodGuardService {
  /** Returns the first SoD violation for a context, or null if permitted. */
  check(context: SodContext) {
    return evaluateSod(context);
  }

  /**
   * Throws `ForbiddenException` (RFC-7807 with a machine reason code) when the
   * action violates a Segregation-of-Duties rule. Structural — enforced in the
   * authorization layer, never by hiding a UI control (SoD-01..08).
   */
  assert(context: SodContext): void {
    const violation = evaluateSod(context);
    if (violation) {
      throw new ForbiddenException({
        title: 'Segregation of duties',
        reasons: [`${violation.rule}: ${violation.message}`],
      });
    }
  }

  /**
   * Asserts that granting a role would not create a forbidden co-hold on a
   * scope (SoD-04/05 at assignment time, 1A₂). `rolesAfterOnScope` is the full
   * set the person would hold on the scope after the grant.
   */
  assertRoleAssignment(rolesAfterOnScope: PlatformRole[]): void {
    const violation = evaluateRoleAssignmentSod(rolesAfterOnScope);
    if (violation) {
      throw new ForbiddenException({
        title: 'Segregation of duties',
        reasons: [`${violation.rule}: ${violation.message}`],
      });
    }
  }
}
