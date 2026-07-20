import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';

/** One append-only audit entry (hash fields are filled by the DB trigger). */
export interface AuditEntry {
  organizationId?: string;
  actorRef: string;
  action: string;
  entityRef: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /**
   * Appends a tamper-evident audit entry. `prev_hash`/`row_hash` are computed
   * by the `fleet.audit_log_hash_chain` BEFORE-INSERT trigger under a per-org
   * advisory lock, so the chain cannot fork under concurrency. Raw insert is
   * used so the trigger-supplied hash columns need no client value. Pass an
   * open transaction as `executor` to append the audit entry atomically with a
   * domain state change (every state change writes audit + outbox in one tx).
   */
  async record(
    entry: AuditEntry,
    executor: Pick<DrizzleDatabase, 'execute'> = this.db,
  ): Promise<void> {
    const before = entry.before === undefined ? null : JSON.stringify(entry.before);
    const after = entry.after === undefined ? null : JSON.stringify(entry.after);
    await executor.execute(sql`
      INSERT INTO fleet.audit_log
        (organization_id, actor_ref, action, entity_ref, before_json, after_json, reason)
      VALUES (
        coalesce(${entry.organizationId ?? null}, '00000000-0000-4000-8000-000000000001')::uuid,
        ${entry.actorRef}, ${entry.action}, ${entry.entityRef},
        ${before}::jsonb, ${after}::jsonb, ${entry.reason ?? null}
      )
    `);
  }

  /**
   * Recomputes the hash chain in the database (identical canonicalization by
   * construction) and returns true if intact for the organization. Walks the
   * chain in `chain_seq` order — the same order the trigger builds it under the
   * advisory lock — so concurrent inserts (whose bigserial ids may be assigned
   * out of commit order) never appear as a false fork (P0-R2-1).
   */
  async verifyChain(
    organizationId = '00000000-0000-4000-8000-000000000001',
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT bool_and(row_hash = expected) AS ok FROM (
        SELECT row_hash,
          digest(
            coalesce(lag(row_hash) OVER (PARTITION BY organization_id ORDER BY chain_seq), ''::bytea)
            || convert_to(concat_ws('|', organization_id::text, actor_ref, action,
                 entity_ref, before_json::text, after_json::text, reason), 'UTF8'),
            'sha256'
          ) AS expected
        FROM fleet.audit_log
        WHERE organization_id = ${organizationId}::uuid
      ) t
    `);
    const rows = result as unknown as Array<{ ok: boolean | null }>;
    return rows[0]?.ok !== false;
  }
}
