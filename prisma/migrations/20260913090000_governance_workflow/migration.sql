-- CreateEnum
CREATE TYPE "PayrollDecisionType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AUDITOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RECALL';
ALTER TYPE "AuditAction" ADD VALUE 'COMMENT';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVATE';
ALTER TYPE "AuditAction" ADD VALUE 'MARK_PAID';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "tin" TEXT;

-- AlterTable
ALTER TABLE "tax_configurations" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "pendingAt" TIMESTAMP(3),
ADD COLUMN     "pendingById" TEXT,
ADD COLUMN     "pendingChanges" TEXT;

-- AlterTable
ALTER TABLE "payroll_runs" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "headcount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "requestedReviewerId" TEXT,
ADD COLUMN     "submissionRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalEmployerSsnit" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalGross" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payroll_details" ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "department" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "employeeCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "employeeName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "flags" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "reliefs" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ssnitNumber" TEXT,
ADD COLUMN     "tin" TEXT;

-- AlterTable
ALTER TABLE "system_configs" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "employerSsnitNumber" TEXT,
ADD COLUMN     "requiredApprovals" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "payroll_decisions" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "PayrollDecisionType" NOT NULL,
    "comment" TEXT,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_comments" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_decisions_payrollRunId_idx" ON "payroll_decisions"("payrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_decisions_payrollRunId_userId_round_key" ON "payroll_decisions"("payrollRunId", "userId", "round");

-- CreateIndex
CREATE INDEX "payroll_comments_payrollRunId_createdAt_idx" ON "payroll_comments"("payrollRunId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_decisions" ADD CONSTRAINT "payroll_decisions_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_decisions" ADD CONSTRAINT "payroll_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_comments" ADD CONSTRAINT "payroll_comments_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_comments" ADD CONSTRAINT "payroll_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: configurations active before maker-checker existed count as approved
UPDATE "tax_configurations" SET "approvedAt" = "updatedAt", "approvedById" = "updatedBy" WHERE "isActive" = true;

-- Audit log is append-only: no application or administrator can edit or delete entries
CREATE OR REPLACE FUNCTION audit_logs_block_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_logs_block_modification();
