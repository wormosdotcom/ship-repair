-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('PARTS', 'LABOR', 'OUTSOURCE', 'OTHER');

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAttachment" (
    "id" TEXT NOT NULL,
    "costLineId" TEXT,
    "workOrderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostLine_workOrderId_idx" ON "CostLine"("workOrderId");

-- CreateIndex
CREATE INDEX "CostAttachment_workOrderId_idx" ON "CostAttachment"("workOrderId");

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAttachment" ADD CONSTRAINT "CostAttachment_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "CostLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAttachment" ADD CONSTRAINT "CostAttachment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAttachment" ADD CONSTRAINT "CostAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
