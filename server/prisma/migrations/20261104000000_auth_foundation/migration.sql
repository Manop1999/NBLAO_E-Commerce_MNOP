-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('INVITED', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "SessionStage" AS ENUM ('PASSWORD_CHANGE_REQUIRED', 'MFA_ENROLLMENT_REQUIRED', 'MFA_REQUIRED', 'FULL');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('PASSWORD_RESET', 'INVITATION');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('SECURITY', 'OPERATIONAL');

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "team_id" UUID,
    "password_hash" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_changed_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_mfa" (
    "staff_id" UUID NOT NULL,
    "secret_ciphertext" BYTEA NOT NULL,
    "enabled_at" TIMESTAMP(3),
    "last_used_step" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_mfa_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "code_hash" BYTEA NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "team_id" UUID,
    "assigned_staff_id" UUID,
    "password_hash" TEXT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "invited_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "status_changed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "subject_type" "SubjectType" NOT NULL,
    "staff_id" UUID,
    "customer_id" UUID,
    "stage" "SessionStage" NOT NULL DEFAULT 'FULL',
    "mfa_verified_at" TIMESTAMP(3),
    "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "idle_expires_at" TIMESTAMP(3) NOT NULL,
    "absolute_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_tokens" (
    "id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "subject_type" "SubjectType" NOT NULL,
    "staff_id" UUID,
    "customer_id" UUID,
    "issued_by_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "AuditCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "actor_type" "SubjectType",
    "actor_id" UUID,
    "subject_type" "SubjectType",
    "subject_id" UUID,
    "team_id" UUID,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_team_id_idx" ON "staff_users"("team_id");

-- CreateIndex
CREATE INDEX "staff_users_role_status_idx" ON "staff_users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key" ON "mfa_recovery_codes"("code_hash");

-- CreateIndex
CREATE INDEX "mfa_recovery_codes_staff_id_idx" ON "mfa_recovery_codes"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customers_team_id_idx" ON "customers"("team_id");

-- CreateIndex
CREATE INDEX "customers_assigned_staff_id_idx" ON "customers"("assigned_staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_staff_id_idx" ON "sessions"("staff_id");

-- CreateIndex
CREATE INDEX "sessions_customer_id_idx" ON "sessions"("customer_id");

-- CreateIndex
CREATE INDEX "sessions_absolute_expires_at_idx" ON "sessions"("absolute_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "account_tokens_staff_id_idx" ON "account_tokens"("staff_id");

-- CreateIndex
CREATE INDEX "account_tokens_customer_id_idx" ON "account_tokens"("customer_id");

-- CreateIndex
CREATE INDEX "audit_events_category_at_idx" ON "audit_events"("category", "at");

-- CreateIndex
CREATE INDEX "audit_events_team_id_at_idx" ON "audit_events"("team_id", "at");

-- CreateIndex
CREATE INDEX "audit_events_subject_id_idx" ON "audit_events"("subject_id");

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_mfa" ADD CONSTRAINT "staff_mfa_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written integrity rules (Phase 1E). Prisma cannot express these.
-- ---------------------------------------------------------------------------

-- Emails are stored normalised to lower case so uniqueness is case-insensitive.
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "customers" ADD CONSTRAINT "customers_email_lowercase" CHECK ("email" = lower("email"));

-- Counters never go negative.
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_failed_login_count_nonnegative" CHECK ("failed_login_count" >= 0);
ALTER TABLE "customers" ADD CONSTRAINT "customers_failed_login_count_nonnegative" CHECK ("failed_login_count" >= 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mfa_failed_attempts_nonnegative" CHECK ("mfa_failed_attempts" >= 0);

-- Only an invited customer (who has not chosen a password yet) has no password hash.
ALTER TABLE "customers" ADD CONSTRAINT "customers_password_matches_status"
  CHECK (("status" = 'INVITED') = ("password_hash" IS NULL));

-- Separation of duties: the staff member who invited a customer cannot approve that customer.
ALTER TABLE "customers" ADD CONSTRAINT "customers_inviter_is_not_approver"
  CHECK ("approved_by_id" IS NULL OR "invited_by_id" IS NULL OR "approved_by_id" <> "invited_by_id");

-- A session or account token belongs to exactly one subject, matching subject_type.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_single_subject" CHECK (
  ("subject_type" = 'STAFF' AND "staff_id" IS NOT NULL AND "customer_id" IS NULL)
  OR ("subject_type" = 'CUSTOMER' AND "customer_id" IS NOT NULL AND "staff_id" IS NULL)
);
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_single_subject" CHECK (
  ("subject_type" = 'STAFF' AND "staff_id" IS NOT NULL AND "customer_id" IS NULL)
  OR ("subject_type" = 'CUSTOMER' AND "customer_id" IS NOT NULL AND "staff_id" IS NULL)
);

-- Customer sessions never carry staff-only stages.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_stage_full"
  CHECK ("subject_type" = 'STAFF' OR "stage" = 'FULL');

-- Expiry ordering.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_absolute_after_created" CHECK ("absolute_expires_at" >= "created_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_idle_within_absolute" CHECK ("idle_expires_at" <= "absolute_expires_at");
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_expiry_after_created" CHECK ("expires_at" > "created_at");

-- Hash lengths: SHA-256 digests are 32 bytes.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_length" CHECK (octet_length("token_hash") = 32);
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_token_hash_length" CHECK (octet_length("token_hash") = 32);
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_code_hash_length" CHECK (octet_length("code_hash") = 32);

-- AES-256-GCM box: 12-byte IV + 16-byte tag + 20-byte (or longer) secret.
ALTER TABLE "staff_mfa" ADD CONSTRAINT "staff_mfa_secret_ciphertext_length" CHECK (octet_length("secret_ciphertext") >= 48);

-- Audit events are append-only: no role may edit or delete them.
CREATE FUNCTION "audit_events_append_only"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% blocked)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "audit_events_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_append_only"();

CREATE TRIGGER "audit_events_no_truncate"
  BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_events_append_only"();
