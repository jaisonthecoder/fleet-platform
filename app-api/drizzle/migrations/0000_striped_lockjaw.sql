CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "ltree";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
CREATE SCHEMA "fleet";
--> statement-breakpoint
CREATE TYPE "public"."fleet_role" AS ENUM('Employee', 'Approver', 'Delegate', 'FleetManager', 'ClusterFleetLead', 'GroupFleetLead', 'ClusterCEO', 'Procurement', 'Finance', 'HR', 'InsuranceLead', 'HSE', 'InternalAudit', 'Executive', 'DataSteward', 'SystemAdmin', 'SubstituteDriver', 'ProfessionalDriver');--> statement-breakpoint
CREATE TYPE "public"."fleet_policy_status" AS ENUM('Draft', 'InReview', 'Approved', 'Active', 'Superseded');--> statement-breakpoint
CREATE TYPE "public"."fleet_workflow_status" AS ENUM('Pending', 'Approved', 'Rejected', 'Escalated', 'Expired');--> statement-breakpoint
CREATE TABLE "fleet"."delegation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"delegator_person_id" uuid NOT NULL,
	"delegate_person_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"one_hop_only" boolean DEFAULT true NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."hierarchy_node" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"parent_id" uuid,
	"level_index" integer NOT NULL,
	"level_label" text NOT NULL,
	"name" text NOT NULL,
	"path" "ltree" NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"default_currency" text DEFAULT 'AED' NOT NULL,
	"default_timezone" text DEFAULT 'Asia/Dubai' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"hcm_employee_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"grade" text,
	"employment_status" text DEFAULT 'Active' NOT NULL,
	"licence_number" text,
	"licence_expiry" date,
	"line_manager_person_id" uuid,
	"home_pool_node_id" uuid,
	"is_professional_driver" boolean DEFAULT false NOT NULL,
	"sponsor" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "fleet_role" NOT NULL,
	"scope_node_id" uuid NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."sod_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"sod_rule_code" text NOT NULL,
	"subject_person_id" uuid NOT NULL,
	"approver_person_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"linked_entity_ref" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."decision_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"rule_type" text NOT NULL,
	"policy_version_id" uuid,
	"context_fingerprint" text,
	"decision" text NOT NULL,
	"reasons" text[],
	"scope_that_answered" text,
	"subject_ref" text,
	"correlation_id" text,
	"evaluated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."policy_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"rule_type" text NOT NULL,
	"scope_node_id" uuid,
	"status" "fleet_policy_status" DEFAULT 'Draft' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_by" text,
	"approved_by" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."policy_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_rule_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"decision_table" jsonb NOT NULL,
	"input_schema_ref" text,
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."workflow_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"workflow_type" text NOT NULL,
	"subject_ref" text NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" "fleet_workflow_status" DEFAULT 'Pending' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."workflow_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"assignee_person_id" uuid,
	"decided_by_person_id" uuid,
	"on_behalf_of_person_id" uuid,
	"decision" text,
	"reason" text,
	"sla_due_at" timestamp with time zone,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fleet"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_ref" text NOT NULL,
	"action" text NOT NULL,
	"entity_ref" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"prev_hash" "bytea",
	"row_hash" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."inbox_message" (
	"consumer_name" text NOT NULL,
	"message_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"result" text
);
--> statement-breakpoint
CREATE TABLE "fleet"."outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"correlation_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "fleet"."scheduled_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"work_type" text NOT NULL,
	"subject_ref" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "fleet"."delegation" ADD CONSTRAINT "delegation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."delegation" ADD CONSTRAINT "delegation_delegator_person_id_person_id_fk" FOREIGN KEY ("delegator_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."delegation" ADD CONSTRAINT "delegation_delegate_person_id_person_id_fk" FOREIGN KEY ("delegate_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_parent_id_hierarchy_node_id_fk" FOREIGN KEY ("parent_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."person" ADD CONSTRAINT "person_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."person" ADD CONSTRAINT "person_line_manager_person_id_person_id_fk" FOREIGN KEY ("line_manager_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."person" ADD CONSTRAINT "person_home_pool_node_id_hierarchy_node_id_fk" FOREIGN KEY ("home_pool_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_assignment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_assignment_scope_node_id_hierarchy_node_id_fk" FOREIGN KEY ("scope_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."sod_exception" ADD CONSTRAINT "sod_exception_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."sod_exception" ADD CONSTRAINT "sod_exception_subject_person_id_person_id_fk" FOREIGN KEY ("subject_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."sod_exception" ADD CONSTRAINT "sod_exception_approver_person_id_person_id_fk" FOREIGN KEY ("approver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."policy_version" ADD CONSTRAINT "policy_version_policy_rule_id_policy_rule_id_fk" FOREIGN KEY ("policy_rule_id") REFERENCES "fleet"."policy_rule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."workflow_step" ADD CONSTRAINT "workflow_step_workflow_instance_id_workflow_instance_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "fleet"."workflow_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hierarchy_node_parent_idx" ON "fleet"."hierarchy_node" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "hierarchy_node_path_idx" ON "fleet"."hierarchy_node" USING gist ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "person_hcm_employee_id_uq" ON "fleet"."person" USING btree ("hcm_employee_id");--> statement-breakpoint
CREATE INDEX "person_line_manager_idx" ON "fleet"."person" USING btree ("line_manager_person_id");--> statement-breakpoint
CREATE INDEX "person_licence_expiry_idx" ON "fleet"."person" USING btree ("licence_expiry");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignment_uq" ON "fleet"."role_assignment" USING btree ("person_id","role","scope_node_id");--> statement-breakpoint
CREATE INDEX "role_assignment_person_idx" ON "fleet"."role_assignment" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "decision_log_rule_idx" ON "fleet"."decision_log" USING btree ("rule_type","evaluated_at_utc");--> statement-breakpoint
CREATE INDEX "policy_rule_type_idx" ON "fleet"."policy_rule" USING btree ("rule_type","status");--> statement-breakpoint
CREATE INDEX "policy_version_rule_idx" ON "fleet"."policy_version" USING btree ("policy_rule_id","version");--> statement-breakpoint
CREATE INDEX "workflow_instance_subject_idx" ON "fleet"."workflow_instance" USING btree ("subject_ref");--> statement-breakpoint
CREATE INDEX "workflow_step_instance_idx" ON "fleet"."workflow_step" USING btree ("workflow_instance_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_message_uq" ON "fleet"."inbox_message" USING btree ("consumer_name","message_id");--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "fleet"."outbox_event" USING btree ("published_at","occurred_at");--> statement-breakpoint
CREATE INDEX "scheduled_work_due_idx" ON "fleet"."scheduled_work" USING btree ("status","due_at");--> statement-breakpoint
CREATE FUNCTION "fleet"."audit_log_hash_chain"() RETURNS trigger AS $$
DECLARE
  v_prev bytea;
  v_payload text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text, 0));
  SELECT row_hash INTO v_prev FROM fleet.audit_log
    WHERE organization_id = NEW.organization_id
    ORDER BY id DESC LIMIT 1;
  v_payload := concat_ws('|', NEW.organization_id::text, NEW.actor_ref, NEW.action,
    NEW.entity_ref, NEW.before_json::text, NEW.after_json::text, NEW.reason);
  NEW.prev_hash := v_prev;
  NEW.row_hash := digest(coalesce(v_prev, ''::bytea) || convert_to(v_payload, 'UTF8'), 'sha256');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "audit_log_hash_chain_trg" BEFORE INSERT ON "fleet"."audit_log"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."audit_log_hash_chain"();--> statement-breakpoint
CREATE FUNCTION "fleet"."audit_log_no_mutate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'fleet.audit_log is append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "audit_log_no_mutate_trg" BEFORE UPDATE OR DELETE ON "fleet"."audit_log"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."audit_log_no_mutate"();--> statement-breakpoint
INSERT INTO "fleet"."organization" ("id", "name", "code")
  VALUES ('00000000-0000-4000-8000-000000000001', 'Reference Organization', 'REF')
  ON CONFLICT ("id") DO NOTHING;