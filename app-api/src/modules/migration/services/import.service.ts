import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateImport,
  IMPORT_COMPLETENESS_THRESHOLD,
  type ImportBatchDto,
  type ImportRowDto,
  type ResolveRow,
} from '../../../contracts/import.contract';
import { AuditService } from '../../platform/services/audit.service';
import { LookupService } from '../../config/services/lookup.service';
import { VehicleService } from '../../vehicles/services/vehicle.service';
import {
  type ClassifyContext,
  classifyRow,
  completenessScore,
  normaliseRow,
  type RawRow,
} from '../internal/validate-row';
import { ImportRepository } from '../repositories/import.repository';

type RowRecord = Awaited<ReturnType<ImportRepository['listRows']>>[number];

/**
 * Bulk migration import pipeline (M3): stage → validate (shape + lookup codes)
 * → dedup (within-batch + against the master) → reconcile (completeness score)
 * → steward sign-off → commit valid rows to the vehicle master. A batch cannot
 * be signed off below the completeness threshold (mitigates R5). Rows are
 * soft-state — status/reason is set, source data is never mutated.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly repo: ImportRepository,
    private readonly lookups: LookupService,
    private readonly vehicles: VehicleService,
    private readonly audit: AuditService,
  ) {}

  /** Stages an uploaded row set, then validates + reconciles it. */
  async createBatch(input: CreateImport, actorRef = 'system'): Promise<ImportBatchDto> {
    const batch = await this.repo.insertBatch({
      source: input.source,
      uploadedByRef: actorRef,
      totalRows: input.rows.length,
      status: 'Staged',
    });
    const rows = await this.repo.insertRows(
      input.rows.map((raw, i) => ({
        batchId: batch.id,
        rowNumber: i + 1,
        rawData: raw as object,
        status: 'Pending' as const,
      })),
    );
    await this.validateAndReconcile(batch.id, rows);
    await this.audit.record({
      actorRef,
      action: 'IMPORT_STAGED',
      entityRef: `import:${batch.id}`,
      after: { source: input.source, rows: input.rows.length },
    });
    return this.getBatch(batch.id);
  }

  /** Returns a batch summary. */
  async getBatch(id: string): Promise<ImportBatchDto> {
    const batch = await this.repo.findBatch(id);
    if (!batch) {
      throw new NotFoundException({ title: 'Unknown import batch', reasons: [`import-not-found:${id}`] });
    }
    return {
      id: batch.id,
      source: batch.source,
      status: batch.status,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      invalidRows: batch.invalidRows,
      duplicateRows: batch.duplicateRows,
      completenessScore: Number(batch.completenessScore),
      signedOffByRef: batch.signedOffByRef,
    };
  }

  /** Lists the staged rows of a batch with their status. */
  async listRows(batchId: string): Promise<ImportRowDto[]> {
    await this.getBatch(batchId);
    const rows = await this.repo.listRows(batchId);
    return rows
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map((r) => ({ id: r.id, rowNumber: r.rowNumber, status: r.status, reason: r.reason, committedVehicleId: r.committedVehicleId }));
  }

  /** Steward resolves a flagged row (accept ⇒ re-include as valid; reject ⇒ exclude). */
  async resolve(batchId: string, input: ResolveRow, actorRef = 'system'): Promise<ImportBatchDto> {
    const row = await this.repo.findRow(input.rowId);
    if (!row || row.batchId !== batchId) {
      throw new NotFoundException({ title: 'Unknown import row', reasons: [`import-row-not-found:${input.rowId}`] });
    }
    await this.repo.updateRow(row.id, {
      status: input.action === 'accept' ? 'Valid' : 'Invalid',
      reason: input.action === 'accept' ? 'steward-accepted' : 'steward-rejected',
    });
    await this.audit.record({
      actorRef,
      action: 'IMPORT_ROW_RESOLVED',
      entityRef: `import-row:${row.id}`,
      after: { action: input.action },
    });
    await this.recount(batchId);
    return this.getBatch(batchId);
  }

  /**
   * Steward sign-off: commits every valid row to the vehicle master. Rejected
   * below the completeness threshold. Idempotent — a committed batch cannot be
   * re-committed.
   */
  async signOff(batchId: string, actorRef = 'system'): Promise<ImportBatchDto> {
    const batch = await this.repo.findBatch(batchId);
    if (!batch) {
      throw new NotFoundException({ title: 'Unknown import batch', reasons: [`import-not-found:${batchId}`] });
    }
    if (batch.status === 'Committed') {
      throw new ConflictException({ title: 'Batch already committed', reasons: ['import-already-committed'] });
    }
    const score = Number(batch.completenessScore);
    if (score < IMPORT_COMPLETENESS_THRESHOLD) {
      throw new BadRequestException({
        title: 'Below completeness threshold',
        reasons: [`completeness-${score}-below-${IMPORT_COMPLETENESS_THRESHOLD}`],
      });
    }

    const rows = await this.repo.listRows(batchId);
    let committed = 0;
    for (const row of rows.filter((r) => r.status === 'Valid')) {
      const norm = normaliseRow(row.rawData as RawRow);
      try {
        const created = await this.vehicles.create(
          {
            plate: norm.plate!,
            chassisVin: norm.chassisVin!,
            bodyTypeCode: norm.bodyTypeCode!,
            fuelTypeCode: norm.fuelTypeCode ?? undefined,
            useCategoryCode: norm.useCategoryCode ?? undefined,
            makeCode: norm.makeCode ?? undefined,
            modelCode: norm.modelCode ?? undefined,
            year: norm.year ?? undefined,
            colour: norm.colour ?? undefined,
          },
          actorRef,
        );
        await this.repo.updateRow(row.id, { status: 'Committed', committedVehicleId: created.id });
        committed += 1;
      } catch {
        await this.repo.updateRow(row.id, { status: 'Invalid', reason: 'commit-failed' });
      }
    }
    await this.repo.updateBatch(batchId, {
      status: 'Committed',
      signedOffByRef: actorRef,
      signedOffAt: new Date(),
    });
    await this.audit.record({
      actorRef,
      action: 'IMPORT_SIGNED_OFF',
      entityRef: `import:${batchId}`,
      after: { committed },
    });
    return this.getBatch(batchId);
  }

  private async validateAndReconcile(batchId: string, rows: RowRecord[]): Promise<void> {
    const ctx = await this.buildContext();
    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    for (const row of rows) {
      const norm = normaliseRow(row.rawData as RawRow);
      const c = classifyRow(norm, ctx);
      await this.repo.updateRow(row.id, { status: c.status, reason: c.reason });
      if (c.status === 'Valid') {
        valid += 1;
        if (norm.plate) ctx.seenPlates.add(norm.plate);
        if (norm.chassisVin) ctx.seenVins.add(norm.chassisVin);
      } else if (c.status === 'Duplicate') {
        duplicate += 1;
        if (c.dedup) {
          await this.repo.insertDedup({
            batchId,
            rowId: row.id,
            matchType: c.dedup.matchType,
            matchValue: c.dedup.matchValue,
          });
        }
      } else {
        invalid += 1;
      }
    }
    await this.repo.updateBatch(batchId, {
      validRows: valid,
      invalidRows: invalid,
      duplicateRows: duplicate,
      completenessScore: String(completenessScore(valid, rows.length)),
      status: 'Validated',
    });
  }

  private async recount(batchId: string): Promise<void> {
    const rows = await this.repo.listRows(batchId);
    const valid = rows.filter((r) => r.status === 'Valid').length;
    const invalid = rows.filter((r) => r.status === 'Invalid').length;
    const duplicate = rows.filter((r) => r.status === 'Duplicate').length;
    await this.repo.updateBatch(batchId, {
      validRows: valid,
      invalidRows: invalid,
      duplicateRows: duplicate,
      completenessScore: String(completenessScore(valid, rows.length)),
    });
  }

  private async buildContext(): Promise<ClassifyContext> {
    const [bodyTypes, fuelTypes, useCategories, existing] = await Promise.all([
      this.safeCodes('vehicle-body-type'),
      this.safeCodes('fuel-type'),
      this.safeCodes('use-category'),
      this.repo.existingIdentifiers(),
    ]);
    return {
      bodyTypes,
      fuelTypes,
      useCategories,
      existingPlates: existing.plates,
      existingVins: existing.vins,
      seenPlates: new Set(),
      seenVins: new Set(),
    };
  }

  /** Loads a lookup type's active codes; an unknown type yields an empty set. */
  private async safeCodes(typeCode: string): Promise<Set<string>> {
    try {
      const values = await this.lookups.getValues(typeCode);
      return new Set(values.map((v) => v.code));
    } catch {
      return new Set();
    }
  }
}
