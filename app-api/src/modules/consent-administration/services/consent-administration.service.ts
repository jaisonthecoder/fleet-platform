import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import type { Principal } from '../../../common/auth/principal';
import type { ConsentDomain, ConsentTemplateDto, CreateConsentTemplate } from '../../../contracts/consent-administration.contract';
import { AuditService } from '../../platform/services/audit.service';
import { ConsentTemplateRepository } from '../repositories/consent-template.repository';

type ConsentRow = NonNullable<Awaited<ReturnType<ConsentTemplateRepository['find']>>>;

@Injectable()
export class ConsentAdministrationService {
  constructor(private readonly repo: ConsentTemplateRepository, private readonly audit: AuditService) {}

  /** Lists governed consent versions for the Principal organization. */
  async list(principal: Principal, domain?: ConsentDomain): Promise<ConsentTemplateDto[]> {
    this.requireActor(principal);
    return (await this.repo.list(principal.organizationId, domain)).map((row) => this.toDto(row));
  }

  /** Creates an immutable bilingual Draft version. */
  async create(input: CreateConsentTemplate, principal: Principal): Promise<ConsentTemplateDto> {
    const actor = this.requireActor(principal);
    const content = { en: input.content.en.trim(), ar: input.content.ar.trim() };
    const contentHash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    return this.repo.transaction(async (tx) => {
      const row = await this.repo.insert({
        organizationId: actor.organizationId,
        domain: input.domain,
        version: input.version.trim(),
        status: 'Draft',
        contentEn: content.en,
        contentAr: content.ar,
        contentSha256: contentHash,
        effectiveAtUtc: new Date(input.effectiveAtUtc),
        createdByPersonId: actor.personId,
      }, tx);
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'CONSENT_TEMPLATE_DRAFT_CREATED', entityRef: `consent-template:${row.id}`, after: { domain: input.domain, version: input.version, contentHash } }, tx);
      return this.toDto(row);
    });
  }

  /** Activates one Draft as the approved source and retires the prior Active version atomically. */
  async activate(id: string, principal: Principal): Promise<ConsentTemplateDto> {
    const actor = this.requireSystemAdmin(principal);
    return this.repo.transaction(async (tx) => {
      const draft = await this.repo.find(id, actor.organizationId, tx);
      if (!draft) throw new NotFoundException({ title: 'Unknown consent template', reasons: [`consent-template-not-found:${id}`] });
      if (draft.status !== 'Draft') throw new ConflictException({ title: 'Only a Draft can be activated', reasons: ['consent-template-not-draft'] });
      if (draft.createdByPersonId === actor.personId) throw new ForbiddenException({ title: 'Consent author cannot activate the same version', reasons: ['consent-template-maker-checker-required'] });
      const at = new Date();
      if (draft.effectiveAtUtc > at) throw new ConflictException({ title: 'Consent version is not effective yet', reasons: ['consent-template-effective-time-pending'] });
      await this.repo.retireOtherActive(actor.organizationId, draft.domain as ConsentDomain, draft.id, actor.personId, at, tx);
      const active = await this.repo.activate(id, actor.organizationId, actor.personId, at, tx);
      if (!active) throw new ConflictException({ title: 'Consent template changed', reasons: ['consent-template-state-conflict'] });
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'CONSENT_TEMPLATE_ACTIVATED', entityRef: `consent-template:${id}`, after: { domain: active.domain, version: active.version, contentHash: active.contentSha256 } }, tx);
      return this.toDto(active);
    });
  }

  /** Retires an Active version and makes the domain fail closed until another activation. */
  async retire(id: string, principal: Principal): Promise<ConsentTemplateDto> {
    const actor = this.requireSystemAdmin(principal);
    return this.repo.transaction(async (tx) => {
      const row = await this.repo.retire(id, actor.organizationId, actor.personId, new Date(), tx);
      if (!row) throw new ConflictException({ title: 'Only an Active template can be retired', reasons: ['consent-template-not-active'] });
      await this.audit.record({ organizationId: actor.organizationId, actorRef: actor.personId, action: 'CONSENT_TEMPLATE_RETIRED', entityRef: `consent-template:${id}`, after: { domain: row.domain, version: row.version } }, tx);
      return this.toDto(row);
    });
  }

  /** Resolves the effective Active content used by production domain providers. */
  async current(domain: ConsentDomain, organizationId = DEFAULT_ORGANIZATION_ID) {
    const row = await this.repo.current(organizationId, domain);
    return row ? { version: row.version, contentHash: row.contentSha256, effectiveAtUtc: row.effectiveAtUtc.toISOString(), content: { en: row.contentEn, ar: row.contentAr } } : null;
  }

  private requireActor(principal: Principal): Principal & { personId: string } {
    if (!principal.personId) throw new ForbiddenException({ title: 'Linked administrator required', reasons: ['consent-administration-person-required'] });
    return principal as Principal & { personId: string };
  }

  private requireSystemAdmin(principal: Principal): Principal & { personId: string } {
    const actor = this.requireActor(principal);
    if (!actor.roles.some(({ role }) => role === 'SystemAdmin')) throw new ForbiddenException({ title: 'System Administrator approval required', reasons: ['consent-activation-system-admin-required'] });
    return actor;
  }

  private toDto(row: ConsentRow): ConsentTemplateDto {
    return {
      id: row.id, domain: row.domain as ConsentDomain, version: row.version, status: row.status as ConsentTemplateDto['status'],
      contentHash: row.contentSha256, effectiveAtUtc: row.effectiveAtUtc.toISOString(), content: { en: row.contentEn, ar: row.contentAr },
      createdByPersonId: row.createdByPersonId, activatedByPersonId: row.activatedByPersonId,
      activatedAtUtc: row.activatedAtUtc?.toISOString() ?? null, retiredAtUtc: row.retiredAtUtc?.toISOString() ?? null,
      createdAtUtc: row.createdAtUtc.toISOString(),
    };
  }
}
