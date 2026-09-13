-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportType" ADD VALUE 'EMPLOYEE_LIST';
ALTER TYPE "ReportType" ADD VALUE 'EARNINGS_SUMMARY';
ALTER TYPE "ReportType" ADD VALUE 'PAY_HISTORY';
ALTER TYPE "ReportType" ADD VALUE 'HEADCOUNT';
ALTER TYPE "ReportType" ADD VALUE 'SALARY_CHANGES';
ALTER TYPE "ReportType" ADD VALUE 'TAX_CERTIFICATE';
ALTER TYPE "ReportType" ADD VALUE 'PAYE_RECONCILIATION';
ALTER TYPE "ReportType" ADD VALUE 'CONFIRMATION_LETTER';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "nationality" TEXT;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "content" BYTEA,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "filters" TEXT,
ADD COLUMN     "rowCount" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'READY';

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_createdById_idx" ON "saved_reports"("createdById");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
