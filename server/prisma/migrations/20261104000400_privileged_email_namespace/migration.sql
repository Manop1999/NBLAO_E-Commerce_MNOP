-- Reserved email namespace for privileged staff accounts (see src/auth/privilegedNamespace.ts, same rule).
-- A staff account is SUPER_ADMIN or ADMIN exactly when its (lower-case) email is at least one character followed by
-- '@admin.nblao.invalid'. TEMPORARY local-development namespace: Phase 1H replaces it with a verified NB LAO
-- domain through a planned migration. Fails (and changes nothing) if any existing row breaks the rule.
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_privileged_namespace"
  CHECK (("role" IN ('SUPER_ADMIN', 'ADMIN')) = ("email" LIKE '_%@admin.nblao.invalid'));
