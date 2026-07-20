import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { vehicle } from '../../../common/database/schema';

/** Where a vehicle-backed lookup type's codes are referenced in the master. */
interface UsageSource {
  table: 'vehicle';
  column: AnyPgColumn;
}

/**
 * Usage counting for lookup values that classify the vehicle master (ADR-009).
 * Maps a lookup `typeCode` to the vehicle column that stores its code, then
 * returns how many vehicles reference each code. Reads the vehicle table via
 * the injected Drizzle client directly (a raw grouped count) so the config
 * module never imports the Vehicles module — keeping the dependency graph
 * acyclic. Unmapped types (not vehicle-backed) return an empty map.
 */
@Injectable()
export class LookupUsageService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Lookup types whose values classify a vehicle column, and where they live. */
  private readonly registry: Record<string, UsageSource> = {
    'vehicle-body-type': { table: 'vehicle', column: vehicle.bodyTypeCode },
    'fuel-type': { table: 'vehicle', column: vehicle.fuelTypeCode },
    'use-category': { table: 'vehicle', column: vehicle.useCategoryCode },
    'vehicle-make': { table: 'vehicle', column: vehicle.makeCode },
    'vehicle-model': { table: 'vehicle', column: vehicle.modelCode },
  };

  /** True when the type's values are referenced by the vehicle master. */
  isTracked(typeCode: string): boolean {
    return typeCode in this.registry;
  }

  /**
   * Returns a map of `code -> reference count` for a vehicle-backed lookup type.
   * Unmapped types return an empty map (no usage tracked).
   */
  async countsByCode(typeCode: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const source = this.registry[typeCode];
    if (!source) {
      return counts;
    }
    const { column } = source;
    const rows = await this.db
      .select({ code: column, n: sql<number>`cast(count(*) as int)` })
      .from(vehicle)
      .where(sql`${column} is not null`)
      .groupBy(column);
    for (const r of rows) {
      if (r.code != null) {
        counts.set(String(r.code), Number(r.n));
      }
    }
    return counts;
  }
}
