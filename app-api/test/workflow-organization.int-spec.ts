import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { organization } from '../src/common/database/schema';
import { WorkflowService } from '../src/modules/workflow/services/workflow.service';

/** Proves workflow definitions and instances retain their owning non-default organization. */
describe('workflow organization provenance (integration)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let workflows: WorkflowService;
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    workflows = ctx.get(WorkflowService);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('persists organization on both the definition and instance', async () => {
    const rollback = new Error('rollback-workflow-organization-proof');
    await expect(db.transaction(async (tx) => {
      const [created] = await tx.insert(organization).values({ name: `Workflow Org ${suffix}`, code: `WF-${suffix}` }).returning({ id: organization.id });
      const organizationId = created.id;
      const started = await workflows.start({ organizationId, workflowType: 'booking-approval', definitionKey: 'legacy-booking-approval-v1', subjectRef: `it:${suffix}`, steps: [{ assigneePersonId: randomUUID(), assignmentKey: 'LineManager' }] }, tx);
      const reassigned = await workflows.start({ organizationId, workflowType: 'booking-approval', definitionKey: 'legacy-booking-approval-v1', subjectRef: `it:reassigned:${suffix}`, steps: [{ assigneePersonId: randomUUID(), assignmentKey: 'LineManager' }] }, tx);
      const rows = await tx.execute(sql`
        SELECT wi.organization_id AS "instanceOrganizationId", wd.organization_id AS "definitionOrganizationId"
        FROM fleet.workflow_instance wi
        JOIN fleet.workflow_definition_deployment deployment ON deployment.id = wi.definition_deployment_id
        JOIN fleet.workflow_definition wd ON wd.id = deployment.workflow_definition_id
        WHERE wi.id = ${started.id}::uuid
      `) as unknown as Array<{ instanceOrganizationId: string; definitionOrganizationId: string }>;
      expect(rows[0]).toEqual({ instanceOrganizationId: organizationId, definitionOrganizationId: organizationId });
      const deployments = await tx.execute(sql`
        SELECT id, definition_deployment_id AS "deploymentId"
        FROM fleet.workflow_instance
        WHERE id IN (${started.id}::uuid, ${reassigned.id}::uuid)
        ORDER BY id
      `) as unknown as Array<{ id: string; deploymentId: string }>;
      expect(deployments).toHaveLength(2);
      expect(new Set(deployments.map((row) => row.deploymentId)).size).toBe(1);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});
