-- CreateEnum
CREATE TYPE "ServiceItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "status" "ServiceItemStatus" NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "model" TEXT,
    "serial" TEXT,
    "serviceContent" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItemEngineer" (
    "id" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ServiceItemEngineer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAttachment" (
    "id" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceItem_workOrderId_idx" ON "ServiceItem"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceItemEngineer_serviceItemId_userId_key" ON "ServiceItemEngineer"("serviceItemId", "userId");

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItemEngineer" ADD CONSTRAINT "ServiceItemEngineer_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItemEngineer" ADD CONSTRAINT "ServiceItemEngineer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAttachment" ADD CONSTRAINT "ServiceAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
