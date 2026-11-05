-- Manager → Admin customer invitation requests. A Manager no longer invites customers directly (that answered
-- differently for an email registered outside the Manager's scope); the Manager files a request without any
-- customer lookup, and an Admin or Super Admin (global customer scope) issues the invitation or declines.
CREATE TYPE "InvitationRequestStatus" AS ENUM ('PENDING', 'ISSUED', 'DECLINED');

CREATE TABLE "customer_invitation_requests" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "team_id" UUID,
    "assigned_staff_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "status" "InvitationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "customer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_invitation_requests_pkey" PRIMARY KEY ("id")
);

-- No unique index on email: one would tell a Manager that another team already asked for the same address.
CREATE UNIQUE INDEX "customer_invitation_requests_customer_id_key" ON "customer_invitation_requests"("customer_id");
CREATE INDEX "customer_invitation_requests_status_created_at_idx" ON "customer_invitation_requests"("status", "created_at");
CREATE INDEX "customer_invitation_requests_requested_by_id_idx" ON "customer_invitation_requests"("requested_by_id");

ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_email_lowercase" CHECK ("email" = lower("email"));
-- A request is decided exactly when it is no longer PENDING.
ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_decision_consistent"
  CHECK (("status" = 'PENDING') = ("decided_at" IS NULL AND "decided_by_id" IS NULL));
-- Only an issued request points at the customer it created.
ALTER TABLE "customer_invitation_requests" ADD CONSTRAINT "customer_invitation_requests_customer_only_if_issued"
  CHECK ("customer_id" IS NULL OR "status" = 'ISSUED');
