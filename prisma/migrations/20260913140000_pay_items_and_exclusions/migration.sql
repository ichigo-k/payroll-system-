-- AlterTable
ALTER TABLE "salary_configurations" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "payroll_details" ADD COLUMN     "lineItems" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "payroll_exclusions" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_exclusions_payrollRunId_employeeId_key" ON "payroll_exclusions"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "payroll_exclusions" ADD CONSTRAINT "payroll_exclusions_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_exclusions" ADD CONSTRAINT "payroll_exclusions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

