import { Module } from '@nestjs/common';
import { PolicyRegistryService } from './internal/policy-registry';
import { PolicyRepository } from './repositories/policy.repository';
import { PolicyAdminService } from './services/policy-admin.service';
import { PolicyCacheService } from './services/policy-cache.service';
import { PolicyEvaluatorService } from './services/policy-evaluator.service';
import {
  DomainDecisionSelectorService,
  DomainDecisionService,
} from './services/domain-decision.service';

/**
 * PDP core (controller-less): the decision evaluator + rule registry + Redis
 * cache + Postgres read-through + activation. Both the standalone `pdp`
 * deployable (PolicyModule) and the `api`'s in-process PEPs (compliance,
 * bookings, fines) import this so business rules are enforced through the PDP,
 * never hard-coded. The separate `pdp` process is a latency-isolation option,
 * not a correctness requirement for Phase 1.
 */
@Module({
  providers: [
    PolicyEvaluatorService,
    PolicyRegistryService,
    PolicyRepository,
    PolicyCacheService,
    PolicyAdminService,
    DomainDecisionSelectorService,
    DomainDecisionService,
  ],
  exports: [
    PolicyEvaluatorService,
    PolicyAdminService,
    PolicyRegistryService,
    PolicyRepository,
    DomainDecisionSelectorService,
    DomainDecisionService,
  ],
})
export class PolicyCoreModule {}
