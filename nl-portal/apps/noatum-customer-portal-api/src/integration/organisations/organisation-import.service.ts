import { createHash } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { TenantRepository } from '../../common/tenancy/tenant.repository';

import { csvBoolean, csvList, parseCsv, requireColumns } from './csv';

export interface ImportOptions {
  /**
   * Only a declared complete snapshot may deactivate organisations by absence.
   * Defaults to FALSE everywhere: doc 12 section 4.5 makes authority something the
   * operator asserts, and it is the one default where being wrong revokes access.
   */
  authoritative?: boolean;
  startedByUserId?: string | null;
}

export interface ImportResult {
  runId: string;
  outcome: 'succeeded' | 'partial' | 'failed';
  read: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  rejected: number;
  addresses: number;
  identifiers: number;
  errors: unknown[];
}

type BatchOutcome = {
  read: number; created: number; updated: number; unchanged: number; rejected: number; errors: unknown[];
};

/** Small enough to stay well inside the interactive-transaction timeout. */
const CHUNK = 200;

/**
 * Pulls the CargoWise organisation export into the portal mirror.
 *
 * Two rules shape this. master_org is writable only through
 * app.apply_organisation_batch, so rows go through that function rather than
 * Prisma; and absence is decided by app.finalise_organisation_import, which owns
 * the truncated-snapshot brake.
 *
 * Transaction shape is deliberate: MANY SHORT transactions, never one long one.
 * Prisma's interactive transactions time out after five seconds, so a directory of
 * any real size cannot be done in a single call — and holding row locks across a
 * whole import would block the portal while it ran.
 */
@Injectable()
export class OrganisationImportService {
  private readonly logger = new Logger(OrganisationImportService.name);

  constructor(
    private readonly repository: TenantRepository,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async run(options: ImportOptions = {}): Promise<ImportResult> {
    const baseUrl = (this.config.get<string>('cw1.organisationExportUrl') ?? '').replace(/\/+$/, '');
    const sourceInstance = this.config.get<string>('cw1.sourceInstance') ?? 'unassigned';
    const authoritative = options.authoritative ?? false;

    // The run row is created BEFORE anything can fail, so an unreachable CargoWise
    // — the most likely failure of all — still leaves the operator a failed run.
    const run = await this.repository.runInternal((tx) =>
      tx.orgImportRun.create({
        data: {
          sourceKind: 'feed',
          sourceSystem: 'cw1',
          sourceInstance,
          mode: 'snapshot',
          isAuthoritative: authoritative,
          startedById: options.startedByUserId ?? null,
          fileName: redactCredentials(`${baseUrl}/organisations.csv`),
        },
        select: { id: true },
      }),
    );

    try {
      if (!baseUrl) {
        throw new Error('CW1_ORG_EXPORT_URL is not configured, so there is no organisation export to read.');
      }

      const organisationsCsv = await this.fetch(`${baseUrl}/organisations.csv`);
      const fileHash = createHash('sha256').update(organisationsCsv, 'utf8').digest('hex');

      // A login page or an HTML error body also arrives as a parseable 200. Without
      // this check every row is silently dropped and the snapshot looks empty — which
      // on a small directory would deactivate all of it.
      const organisations = parseCsv(organisationsCsv);
      requireColumns(organisations, ['org_code', 'full_name'], 'organisations.csv');

      const softFailures: unknown[] = [];
      const addressesCsv = await this.fetchOptional(`${baseUrl}/organisation_addresses.csv`, softFailures);
      const registrationsCsv = await this.fetchOptional(`${baseUrl}/organisation_registrations.csv`, softFailures);

      const rows = organisations
        .filter((row) => (row.org_code ?? '').trim() !== '')
        .map((row) => ({
          sourceCode: row.org_code!.trim(),
          sourceSystem: 'cw1',
          sourceInstance,
          name: (row.full_name ?? '').trim(),
          category: emptyToNull(row.category),
          isActive: csvBoolean(row.is_active, true),
          countryCode: emptyToNull(row.country_code),
          city: emptyToNull(row.city),
          state: emptyToNull(row.state),
          postcode: emptyToNull(row.postcode),
          controllingCustomerCode: emptyToNull(row.controlling_customer_code),
          sourceBranchCode: emptyToNull(row.controlling_branch_code),
          roles: csvList(row.roles),
          sourceVersion: emptyToNull(row.source_last_edit_utc),
        }));

      const batch = await this.applyBatch(run.id, rows);
      const finalised = await this.finalise(run.id, rows.map((row) => row.sourceCode));
      const addresses = await this.syncAddresses(parseCsv(addressesCsv), sourceInstance);
      const identifiers = await this.syncIdentifiers(parseCsv(registrationsCsv), sourceInstance);

      const errors = [
        ...batch.errors,
        ...softFailures,
        ...(finalised.refused
          ? [{ code: finalised.refused, seen: finalised.seen, activeBefore: finalised.activeBefore }]
          : []),
      ];
      const clean = errors.length === 0 && batch.rejected === 0;

      await this.repository.runInternal((tx) =>
        tx.orgImportRun.update({
          where: { id: run.id },
          data: {
            fileHash,
            rowsRead: batch.read,
            rowsCreated: batch.created,
            rowsUpdated: batch.updated,
            rowsUnchanged: batch.unchanged,
            rowsRejected: batch.rejected,
            errors: asJson(errors),
            // 'aborted' is the enum's word for a run that declined to act, so the UI
            // reads a status rather than string-matching inside the errors blob.
            outcome: finalised.refused ? 'aborted' : 'succeeded',
            finishedAt: new Date(),
          },
        }),
      );

      return {
        runId: run.id,
        outcome: clean ? 'succeeded' : 'partial',
        read: batch.read,
        created: batch.created,
        updated: batch.updated,
        unchanged: batch.unchanged,
        deactivated: finalised.deactivated,
        rejected: batch.rejected,
        addresses,
        identifiers,
        errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import failure';
      await this.repository.runInternal((tx) =>
        tx.orgImportRun.update({
          where: { id: run.id },
          data: { outcome: 'failed', finishedAt: new Date(), errors: asJson([{ message: redactCredentials(message) }]) },
        }),
      );
      throw error;
    }
  }

  private async fetch(url: string): Promise<string> {
    const timeout = this.config.get<number>('cw1.timeoutMs') ?? 15_000;
    const username = this.config.get<string>('cw1.username') ?? '';
    const password = this.config.get<string>('cw1.password') ?? '';
    const response = await firstValueFrom(
      this.http.get<string>(url, {
        timeout,
        responseType: 'text',
        // Credentials travel in the header, never in a URL that gets persisted.
        ...(username ? { auth: { username, password } } : {}),
      }),
    );
    return typeof response.data === 'string' ? response.data : String(response.data ?? '');
  }

  /**
   * Addresses and registrations are supplementary, so a failure here does not fail
   * the run — but it is recorded, because "succeeded with zero addresses" and "the
   * address file returned 500" must not look the same.
   */
  private async fetchOptional(url: string, failures: unknown[]): Promise<string> {
    try {
      return await this.fetch(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      failures.push({
        code: 'OPTIONAL_FILE_UNREADABLE',
        file: redactCredentials(url),
        message: redactCredentials(message),
      });
      this.logger.warn(`Optional export ${redactCredentials(url)} could not be read: ${message}`);
      return '';
    }
  }

  /** One transaction per chunk: a long import must not hold a single transaction open. */
  private async applyBatch(runId: string, rows: unknown[]): Promise<BatchOutcome> {
    const total: BatchOutcome = { read: 0, created: 0, updated: 0, unchanged: 0, rejected: 0, errors: [] };

    for (let index = 0; index < rows.length; index += CHUNK) {
      const slice = rows.slice(index, index + CHUNK);
      const outcome = await this.repository.runInternal(async (tx) => {
        const [result] = await tx.$queryRaw<{ apply_organisation_batch: BatchOutcome }[]>`
          SELECT app.apply_organisation_batch(${runId}::uuid, ${JSON.stringify(slice)}::jsonb)`;
        return result?.apply_organisation_batch;
      });
      if (!outcome) continue;
      total.read += outcome.read ?? 0;
      total.created += outcome.created ?? 0;
      total.updated += outcome.updated ?? 0;
      total.unchanged += outcome.unchanged ?? 0;
      total.rejected += outcome.rejected ?? 0;
      if (Array.isArray(outcome.errors)) total.errors.push(...outcome.errors);
    }

    return total;
  }

  private async finalise(runId: string, seenCodes: string[]) {
    const outcome = await this.repository.runInternal(async (tx) => {
      const [result] = await tx.$queryRaw<{ finalise_organisation_import: {
        deactivated: number; refused?: string; seen?: number; activeBefore?: number;
      } }[]>`
        SELECT app.finalise_organisation_import(${runId}::uuid, ${seenCodes}::text[])`;
      return result?.finalise_organisation_import;
    });

    return {
      deactivated: outcome?.deactivated ?? 0,
      refused: outcome?.refused,
      seen: outcome?.seen,
      activeBefore: outcome?.activeBefore,
    };
  }

  private async syncAddresses(rows: Record<string, string>[], sourceInstance: string): Promise<number> {
    if (rows.length === 0) return 0;
    const owners = await this.orgIdsByCode(sourceInstance);
    let written = 0;

    for (let index = 0; index < rows.length; index += CHUNK) {
      const slice = rows.slice(index, index + CHUNK);
      written += await this.repository.runInternal(async (tx) => {
        let count = 0;
        for (const row of slice) {
          const orgId = owners.get(normalise(row.org_code));
          const addressCode = (row.address_code ?? '').trim();
          if (!orgId || addressCode === '') continue;

          const data = {
            purposes: csvList(row.address_types),
            isPrimary: csvBoolean(row.is_main_address),
            companyNameOverride: emptyToNull(row.company_name_override),
            addressLine1: emptyToNull(row.address_1),
            addressLine2: emptyToNull(row.address_2),
            city: emptyToNull(row.city),
            state: emptyToNull(row.state),
            postcode: emptyToNull(row.postcode),
            countryCode: emptyToNull(row.country_code),
            relatedPortCode: emptyToNull(row.related_port_code),
            email: emptyToNull(row.email),
            phone: emptyToNull(row.phone),
            isActive: csvBoolean(row.is_active, true),
          };

          await tx.orgAddress.upsert({
            where: { orgId_sourceAddressCode: { orgId, sourceAddressCode: addressCode } },
            create: { orgId, sourceAddressCode: addressCode, ...data },
            update: data,
          });
          count += 1;
        }
        return count;
      });
    }

    return written;
  }

  private async syncIdentifiers(rows: Record<string, string>[], sourceInstance: string): Promise<number> {
    if (rows.length === 0) return 0;
    const owners = await this.orgIdsByCode(sourceInstance);
    let written = 0;

    for (let index = 0; index < rows.length; index += CHUNK) {
      const slice = rows.slice(index, index + CHUNK);
      written += await this.repository.runInternal(async (tx) => {
        let count = 0;
        for (const row of slice) {
          const orgId = owners.get(normalise(row.org_code));
          const scheme = (row.code_type ?? '').trim();
          const value = (row.value ?? '').trim();
          if (!orgId || scheme === '' || value === '') continue;

          // doc 12 section 4.5 names this column country_code; it feeds the
          // jurisdiction column on our side.
          const jurisdiction = emptyToNull(row.country_code);
          const isDefault = csvBoolean(row.is_country_default);

          // The unique index is (org_id, scheme, value, COALESCE(jurisdiction,'')),
          // an expression Prisma cannot express, so the target is written by hand.
          await tx.$executeRaw`
            INSERT INTO org_registration_id (org_id, scheme, value, jurisdiction, is_country_default, updated_at)
            VALUES (${orgId}::uuid, ${scheme}, ${value}, ${jurisdiction}, ${isDefault}, now())
            ON CONFLICT (org_id, scheme, value, (COALESCE(jurisdiction, ''))) DO UPDATE
               SET is_country_default = EXCLUDED.is_country_default,
                   updated_at = now()`;
          count += 1;
        }
        return count;
      });
    }

    return written;
  }

  private async orgIdsByCode(sourceInstance: string): Promise<Map<string, string>> {
    const rows = await this.repository.runInternal((tx) =>
      tx.$queryRaw<{ id: string; code_norm: string }[]>`
        SELECT id, code_norm FROM master_org
         WHERE source_system = 'cw1' AND source_instance = ${sourceInstance}`,
    );
    return new Map(rows.map((row) => [row.code_norm, row.id]));
  }
}

const emptyToNull = (value: string | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
};

const normalise = (value: string | undefined) => (value ?? '').trim().toLowerCase();

/** Keeps basic-auth credentials out of stored file names and error messages. */
const redactCredentials = (value: string) => value.replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//***:***@');

// Prisma's Json input type rejects a bare unknown[]; the cast keeps it honest at the edge.
const asJson = (value: unknown[]) => value as never;
