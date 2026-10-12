import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../../common/tenancy/prisma.service';

/**
 * Portal value to CW1 code translation, and back.
 *
 * mapping_entry is reference data, not customer data: no tenant scoping, no RLS, so
 * PrismaService is used directly. Cached in memory because it changes about as often as
 * a deployment.
 *
 * Domains in use: transport_mode, container_type, package_type, charge_code,
 * document_type, milestone_code.
 */
@Injectable()
export class MappingService {
  private toCw1Cache = new Map<string, string>();
  private fromCw1Cache = new Map<string, string>();
  private loaded = false;

  constructor(private readonly prisma: PrismaService) {}

  async toCw1(domain: string, portalCode: string): Promise<string> {
    await this.ensureLoaded();

    const value = this.toCw1Cache.get(`${domain}:${portalCode}`);
    if (!value) {
      // Guessing a code sends wrong data to CW1, which is worse than a failed request.
      throw new InternalServerErrorException(
        `No CW1 mapping for ${domain}/${portalCode}. Add a mapping_entry row.`,
      );
    }
    return value;
  }

  /** Inbound direction is lenient: an unmapped CW1 code is passed through unchanged. */
  async fromCw1(domain: string, cw1Code: string): Promise<string> {
    await this.ensureLoaded();
    return this.fromCw1Cache.get(`${domain}:${cw1Code}`) ?? cw1Code;
  }

  /** Call after editing mapping_entry, and from the mapping-refresh job. */
  invalidate(): void {
    this.loaded = false;
    this.toCw1Cache.clear();
    this.fromCw1Cache.clear();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const rows = await this.prisma.mappingEntry.findMany({
      select: { domain: true, portalCode: true, cw1Code: true },
    });

    for (const row of rows) {
      this.toCw1Cache.set(`${row.domain}:${row.portalCode}`, row.cw1Code);
      this.fromCw1Cache.set(`${row.domain}:${row.cw1Code}`, row.portalCode);
    }

    this.loaded = true;
  }
}
