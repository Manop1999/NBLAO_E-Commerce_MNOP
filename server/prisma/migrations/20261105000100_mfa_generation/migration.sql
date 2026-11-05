-- 2FA enrolment generation: an atomic marker replacing timestamp comparison in lost-race detection.
-- staff_mfa.generation is incremented inside the conditional update that activates an authenticator; a session
-- records the generation it confirmed 2FA against. A confirmation lost a concurrent race exactly when the account's
-- generation is newer than its session's. Additive only: existing rows keep generation 0 and sessions keep NULL
-- (a session that confirmed 2FA before this migration counts as generation 0), so no data is rewritten.
ALTER TABLE "staff_mfa" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sessions" ADD COLUMN "mfa_generation" INTEGER;

ALTER TABLE "staff_mfa" ADD CONSTRAINT "staff_mfa_generation_nonnegative" CHECK ("generation" >= 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mfa_generation_nonnegative" CHECK ("mfa_generation" IS NULL OR "mfa_generation" >= 0);
