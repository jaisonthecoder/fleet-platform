import { Injectable } from '@nestjs/common';

import { ReferenceItemDto } from '../../contracts';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';

/**
 * Read-only reference data, for anyone signed in.
 *
 * The lookups module exists already, but every route on it is behind
 * `admin.lookups.manage` - it is the screen an administrator maintains the data
 * with. That left the data itself unreadable by the people who need it: a pricer
 * choosing a carrier, a customer choosing a packaging type. Each screen was
 * therefore hard-coding its own list, which is how `package_type` came to exist
 * in the database and in three TypeScript arrays at the same time.
 *
 * This is the other half: one place any screen can ask "what are the valid
 * values for X", honouring who is asking.
 */
@Injectable()
export class ReferenceService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  /**
   * Active items of one category, labelled for the caller's locale.
   *
   * A customer sees only the items marked customer-visible. That flag is the
   * business saying "this label is fit to show outside", and internal codes -
   * CargoWise event codes, document categories - are not.
   *
   * `mode` filters on `metadata.modes`, so an air quote is not offered MSC. An
   * item with no modes recorded is returned for every mode: an incomplete row
   * should narrow nothing.
   */
  async items(categoryCode: string, options: { locale?: string; mode?: string } = {}): Promise<ReferenceItemDto[]> {
    const actor = this.context.require();
    const locale = normaliseLocale(options.locale);

    const read = async (tx: TenantClient) => {
      const rows = await tx.lookupItem.findMany({
        where: {
          category: { code: categoryCode, isActive: true },
          isActive: true,
          ...(actor.isInternal ? {} : { isCustomerVisible: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: {
          code: true,
          metadata: true,
          translations: { select: { locale: true, label: true, description: true } },
        },
      });

      return rows
        .filter((row) => matchesMode(row.metadata, options.mode))
        .map((row) => {
          const preferred = row.translations.find((entry) => entry.locale === locale);
          const fallback = row.translations[0];

          return {
            code: row.code,
            // Falls back to the other locale rather than showing a bare code: a
            // half-translated list should read as a list, not as an error.
            label: preferred?.label ?? fallback?.label ?? row.code,
            // No fallback across locales: a subtitle in the wrong language reads
            // as a bug, and it is decoration, so omitting it costs nothing.
            description: preferred?.description ?? null,
            metadata: (row.metadata ?? null) as Record<string, unknown> | null,
          };
        });
    };

    // Reference data belongs to the platform, not to a customer, so it is read
    // internally when staff ask and under the tenant context otherwise. Neither
    // path filters by group: there is nothing tenant-scoped here to filter.
    return actor.isInternal ? this.repo.runInternal(read) : this.repo.run(read);
  }
}

function normaliseLocale(locale: string | undefined): string {
  if (!locale) return 'en-US';
  return locale.startsWith('es') ? 'es-ES' : 'en-US';
}

function matchesMode(metadata: unknown, mode: string | undefined): boolean {
  if (!mode) return true;
  const modes = (metadata as { modes?: unknown } | null)?.modes;
  return !Array.isArray(modes) || modes.length === 0 || modes.includes(mode);
}
