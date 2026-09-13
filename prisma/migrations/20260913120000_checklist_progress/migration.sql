-- CreateTable
CREATE TABLE "checklist_progress" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" TEXT,

    CONSTRAINT "checklist_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_progress_scope_stepKey_key" ON "checklist_progress"("scope", "stepKey");

