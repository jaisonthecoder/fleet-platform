import { Injectable } from '@nestjs/common';

import type { PortDto, PortSearch } from '../../contracts';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';

/**
 * The port directory, for route autocomplete.
 *
 * A sibling of ReferenceService rather than part of it: the lookups answer "what
 * are the valid values of this field" for lists an administrator curates by hand,
 * and this answers "which of a hundred thousand locations did you mean". Same
 * audience, different question, different index.
 *
 * Searching happens in Postgres and not in the browser for the obvious reason -
 * the whole directory is far too large to ship - and in Postgres rather than a
 * search engine because ADR-004 and ADR-008 hold this platform to one datastore.
 */
@Injectable()
export class PortsService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  /**
   * Prefix matches on name and code, best-guess order.
   *
   * PREFIX, not "contains": `port_name_prefix_idx` answers `LIKE 'val%'` from the
   * index and cannot answer `LIKE '%val%'`, which would become a sequential scan
   * of the directory on every keystroke. Infix and fuzzy matching are a pg_trgm
   * index away when the business asks for them.
   *
   * A code match sorts first because typing five characters that look like a
   * UN/LOCODE is someone who already knows the answer.
   */
  async search(input: PortSearch): Promise<PortDto[]> {
    const actor = this.context.require();
    /*
     * No text means no prefix: every row qualifies and the list comes back in
     * name order, which is the only order somebody browsing can navigate. The
     * SQL keeps one shape either way - a null prefix disables the three LIKEs
     * and flattens the ranking - rather than branching into a second query.
     */
    const typed = (input.q ?? '').trim();
    const prefix = typed === '' ? null : `${typed.toLowerCase()}%`;
    const locale = input.locale?.startsWith('es') ? 'es-ES' : 'en-US';

    const read = async (tx: TenantClient): Promise<PortDto[]> => {
      const rows = await tx.$queryRaw<
        {
          code: string;
          name: string;
          country_code: string;
          country_name: string | null;
          subdivision: string | null;
          is_seaport: boolean;
          is_airport: boolean;
        }[]
      >`
        WITH country AS (
          SELECT i.code AS code, t.label AS name
            FROM lookup_item i
            JOIN lookup_category c ON c.id = i.category_id AND c.code = 'country'
            JOIN lookup_item_translation t ON t.item_id = i.id AND t.locale = ${locale}
           WHERE i.is_active
        )
        SELECT p.code, p.name, p.country_code, c.name AS country_name,
               p.subdivision, p.is_seaport, p.is_airport
          FROM port p
          LEFT JOIN country c ON c.code = p.country_code
         WHERE (
                 ${prefix}::text IS NULL
                 OR lower(p.name) LIKE ${prefix}
                 OR lower(p.code) LIKE ${prefix}
                 -- The country name matters most: "Spain" is what a customer
                 -- remembers, and the 250-row lookup makes this join free.
                 OR lower(c.name) LIKE ${prefix}
               )
           AND (${input.country ?? null}::text IS NULL OR p.country_code = ${input.country ?? null})
           AND (
             ${input.mode ?? null}::text IS NULL
             OR (${input.mode ?? null} = 'sea' AND p.is_seaport)
             OR (${input.mode ?? null} = 'air' AND p.is_airport)
           )
         -- A typed code is somebody who already knows the answer, so it leads. A
         -- port name beats a country match, because "Valencia" should not be
         -- buried under every port in a country beginning "Val".
         ORDER BY (${prefix}::text IS NOT NULL AND lower(p.code) LIKE ${prefix}) DESC,
                  (${prefix}::text IS NOT NULL AND lower(p.name) LIKE ${prefix}) DESC,
                  p.name ASC
         LIMIT ${input.limit}`;

      return rows.map((row) => ({
        code: row.code.trim(),
        name: row.name,
        countryCode: row.country_code.trim(),
        countryName: row.country_name,
        subdivision: row.subdivision,
        isSeaport: row.is_seaport,
        isAirport: row.is_airport,
      }));
    };

    // The directory belongs to the platform, not to a customer. Staff read it
    // internally so a location retired from the offer is still visible to them;
    // everyone else reads under RLS, which returns only active rows.
    return actor.isInternal ? this.repo.runInternal(read) : this.repo.run(read);
  }
}
