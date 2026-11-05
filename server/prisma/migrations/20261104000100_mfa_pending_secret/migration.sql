-- Re-enrolment of an enabled authenticator keeps the current secret until the new one is confirmed.
ALTER TABLE "staff_mfa" ADD COLUMN "pending_secret_ciphertext" BYTEA,
ADD COLUMN "pending_created_at" TIMESTAMP(3);

ALTER TABLE "staff_mfa" ADD CONSTRAINT "staff_mfa_pending_secret_consistent" CHECK (
  ("pending_secret_ciphertext" IS NULL) = ("pending_created_at" IS NULL)
  AND ("pending_secret_ciphertext" IS NULL OR octet_length("pending_secret_ciphertext") >= 48)
);
