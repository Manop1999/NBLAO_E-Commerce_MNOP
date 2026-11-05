-- Per account + source 2FA throttle (replaces the account-wide 2FA lock, which let anyone with the password lock a
-- colleague's 2FA). Source addresses are stored only as SHA-256 digests.
CREATE TABLE "mfa_throttles" (
    "id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "source_hash" BYTEA NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL,
    "block_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mfa_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_throttles_staff_id_source_hash_key" ON "mfa_throttles"("staff_id", "source_hash");

ALTER TABLE "mfa_throttles" ADD CONSTRAINT "mfa_throttles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_throttles" ADD CONSTRAINT "mfa_throttles_counts_nonnegative" CHECK ("failed_count" >= 0 AND "block_count" >= 0);
ALTER TABLE "mfa_throttles" ADD CONSTRAINT "mfa_throttles_source_hash_length" CHECK (octet_length("source_hash") = 32);

-- The account-wide lock is no longer used; clear any lock set by the previous design (data in this column is
-- never read again).
UPDATE "staff_users" SET "mfa_locked_until" = NULL WHERE "mfa_locked_until" IS NOT NULL;
