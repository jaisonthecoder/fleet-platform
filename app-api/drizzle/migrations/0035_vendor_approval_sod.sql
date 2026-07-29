ALTER TABLE "fleet"."vendor" ADD COLUMN "created_by_actor_ref" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet"."vendor" ADD COLUMN "submitted_by_actor_ref" text;