-- DropForeignKey
ALTER TABLE "Vendor" DROP CONSTRAINT "Vendor_ownerUserId_fkey";

-- DropIndex
DROP INDEX "Vendor_ownerUserId_status_idx";

-- DropIndex
DROP INDEX "Vendor_ownerUserId_userId_key";

-- DropIndex
DROP INDEX "Vendor_userId_idx";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "ownerUserId";

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_userId_key" ON "Vendor"("userId");

-- CreateIndex
CREATE INDEX "Vendor_status_trade_idx" ON "Vendor"("status", "trade");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

