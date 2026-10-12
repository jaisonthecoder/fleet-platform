BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "customer_tier" AS ENUM ('basic', 'standard', 'premium');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('invited', 'active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('draft', 'rated', 'rate_failed', 'expired', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "transport_mode" AS ENUM ('air', 'sea', 'road', 'rail');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'dead');

-- CreateTable
CREATE TABLE "customer_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "tier" "customer_tier" NOT NULL DEFAULT 'standard',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "cw1_org_code" VARCHAR(40) NOT NULL,
    "country_code" CHAR(2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_org" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(240) NOT NULL,
    "country_code" CHAR(2),
    "city" VARCHAR(120),
    "is_customer" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_org_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID,
    "entra_object_id" UUID,
    "email" CITEXT NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "status" "user_status" NOT NULL DEFAULT 'invited',
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(400),
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "key" VARCHAR(80) NOT NULL,
    "description" VARCHAR(400),

    CONSTRAINT "permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(80) NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_account_access" (
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,

    CONSTRAINT "user_account_access_pkey" PRIMARY KEY ("user_id","account_id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "invited_by_id" UUID,
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID NOT NULL,
    "account_id" UUID,
    "reference" VARCHAR(40) NOT NULL,
    "status" "quote_status" NOT NULL DEFAULT 'draft',
    "mode" "transport_mode" NOT NULL,
    "origin_code" VARCHAR(20) NOT NULL,
    "destination_code" VARCHAR(20) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "rate_response" JSONB,
    "gross_weight_kg" DECIMAL(12,3),
    "chargeable_kg" DECIMAL(12,3),
    "total_minor_units" BIGINT,
    "currency" CHAR(3),
    "valid_until" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "owner_id" UUID,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quote_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_book_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_name" VARCHAR(200),
    "email" CITEXT,
    "phone" VARCHAR(40),
    "line1" VARCHAR(200),
    "line2" VARCHAR(200),
    "city" VARCHAR(120),
    "state" VARCHAR(120),
    "postcode" VARCHAR(20),
    "country_code" CHAR(2),
    "cw1_org_code" VARCHAR(40),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "address_book_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID,
    "title" VARCHAR(240) NOT NULL,
    "slug" VARCHAR(240) NOT NULL,
    "body" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en-US',
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "news_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domain" VARCHAR(60) NOT NULL,
    "portal_code" VARCHAR(80) NOT NULL,
    "cw1_code" VARCHAR(80) NOT NULL,
    "notes" VARCHAR(400),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mapping_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "status" "job_status" NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_group_id" UUID,
    "actor_user_id" UUID,
    "on_behalf_of_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_group_slug_key" ON "customer_group"("slug");

-- CreateIndex
CREATE INDEX "customer_account_customer_group_id_idx" ON "customer_account"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_account_customer_group_id_cw1_org_code_key" ON "customer_account"("customer_group_id", "cw1_org_code");

-- CreateIndex
CREATE INDEX "master_org_name_idx" ON "master_org"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_entra_object_id_key" ON "user"("entra_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_customer_group_id_idx" ON "user"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_token_hash_key" ON "invitation"("token_hash");

-- CreateIndex
CREATE INDEX "invitation_customer_group_id_status_idx" ON "invitation"("customer_group_id", "status");

-- CreateIndex
CREATE INDEX "quote_customer_group_id_status_created_at_idx" ON "quote"("customer_group_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quote_customer_group_id_reference_key" ON "quote"("customer_group_id", "reference");

-- CreateIndex
CREATE INDEX "quote_template_customer_group_id_idx" ON "quote_template"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_template_customer_group_id_name_key" ON "quote_template"("customer_group_id", "name");

-- CreateIndex
CREATE INDEX "address_book_entry_customer_group_id_name_idx" ON "address_book_entry"("customer_group_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "news_item_slug_key" ON "news_item"("slug");

-- CreateIndex
CREATE INDEX "news_item_published_at_idx" ON "news_item"("published_at");

-- CreateIndex
CREATE INDEX "mapping_entry_domain_cw1_code_idx" ON "mapping_entry"("domain", "cw1_code");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_entry_domain_portal_code_key" ON "mapping_entry"("domain", "portal_code");

-- CreateIndex
CREATE INDEX "job_run_name_status_created_at_idx" ON "job_run"("name", "status", "created_at");

-- CreateIndex
CREATE INDEX "audit_event_customer_group_id_created_at_idx" ON "audit_event"("customer_group_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_event_entity_type_entity_id_idx" ON "audit_event"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "customer_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "customer_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template" ADD CONSTRAINT "quote_template_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_book_entry" ADD CONSTRAINT "address_book_entry_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customer_group', 'customer_account', 'user', 'invitation', 'quote',
        'quote_template', 'address_book_entry', 'news_item', 'audit_event'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('CREATE POLICY initial_deny ON %I USING (false) WITH CHECK (false)', table_name);
    END LOOP;

    FOREACH table_name IN ARRAY ARRAY[
        'master_org', 'role', 'permission', 'role_permission', 'user_role',
        'user_account_access', 'mapping_entry', 'job_run'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format(
            'CREATE POLICY internal_only ON %I USING (COALESCE(NULLIF(current_setting(''app.is_internal'', true), ''''), ''false'')::boolean) WITH CHECK (COALESCE(NULLIF(current_setting(''app.is_internal'', true), ''''), ''false'')::boolean)',
            table_name
        );
    END LOOP;
END
$$;

COMMIT;
