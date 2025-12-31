/*
  Warnings:

  - Added the required column `city` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerCompany` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imo` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationName` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationType` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operatingCompany` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderType` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentTerms` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vesselName` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'PENDING_SERVICE', 'IN_SERVICE', 'COMPLETED', 'PENDING_SETTLEMENT');

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "customerCompany" TEXT NOT NULL,
ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "grossTonnage" INTEGER,
ADD COLUMN     "imo" TEXT NOT NULL,
ADD COLUMN     "locationName" TEXT NOT NULL,
ADD COLUMN     "locationType" TEXT NOT NULL,
ADD COLUMN     "operatingCompany" TEXT NOT NULL,
ADD COLUMN     "orderType" TEXT NOT NULL,
ADD COLUMN     "paymentTerms" TEXT NOT NULL,
ADD COLUMN     "po" TEXT,
ADD COLUMN     "responsibleEngineerName" TEXT,
ADD COLUMN     "responsibleOpsName" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "vesselName" TEXT NOT NULL,
ADD COLUMN     "vesselNotes" TEXT,
ADD COLUMN     "vesselType" TEXT,
ADD COLUMN     "yearBuilt" INTEGER,
ALTER COLUMN "internalNo" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedWorkOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrder_imo_idx" ON "WorkOrder"("imo");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
