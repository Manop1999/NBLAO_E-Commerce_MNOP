-- Separate two-factor failure counter and lock (independent of the password lockout).
ALTER TABLE "staff_users" ADD COLUMN "mfa_failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfa_locked_until" TIMESTAMP(3);

ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_mfa_failed_count_nonnegative" CHECK ("mfa_failed_count" >= 0);
