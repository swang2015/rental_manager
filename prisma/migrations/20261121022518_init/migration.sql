-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'PROPERTY_MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('MANAGER', 'TENANT');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" "InvitationKind" NOT NULL,
    "role" "MembershipRole",
    "tenantId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "portalUserId" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION NOT NULL,
    "rentAmountCents" INTEGER NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "rentAmountCents" INTEGER NOT NULL,
    "depositAmountCents" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "terminationReason" TEXT,
    "predecessorLeaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentCharge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "triageNote" TEXT,
    "cancelledReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assigneeMembershipId" TEXT,
    "scheduledFor" DATE,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "resolutionNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "MaintenanceStatus",
    "toStatus" "MaintenanceStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Membership_organizationId_role_idx" ON "Membership"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_kind_acceptedAt_idx" ON "Invitation"("organizationId", "kind", "acceptedAt");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_status_idx" ON "Tenant"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Tenant_portalUserId_idx" ON "Tenant"("portalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_organizationId_email_key" ON "Tenant"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Property_organizationId_archivedAt_idx" ON "Property"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "Property_organizationId_name_idx" ON "Property"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Unit_organizationId_status_idx" ON "Unit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Unit_organizationId_propertyId_idx" ON "Unit"("organizationId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_label_key" ON "Unit"("propertyId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_predecessorLeaseId_key" ON "Lease"("predecessorLeaseId");

-- CreateIndex
CREATE INDEX "Lease_organizationId_status_idx" ON "Lease"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Lease_organizationId_unitId_idx" ON "Lease"("organizationId", "unitId");

-- CreateIndex
CREATE INDEX "Lease_organizationId_tenantId_idx" ON "Lease"("organizationId", "tenantId");

-- CreateIndex
CREATE INDEX "RentCharge_organizationId_dueDate_idx" ON "RentCharge"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "RentCharge_organizationId_balanceCents_idx" ON "RentCharge"("organizationId", "balanceCents");

-- CreateIndex
CREATE UNIQUE INDEX "RentCharge_leaseId_periodStart_key" ON "RentCharge"("leaseId", "periodStart");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidOn_idx" ON "Payment"("organizationId", "paidOn");

-- CreateIndex
CREATE INDEX "Payment_chargeId_idx" ON "Payment"("chargeId");

-- CreateIndex
CREATE INDEX "Adjustment_organizationId_createdAt_idx" ON "Adjustment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Adjustment_chargeId_idx" ON "Adjustment"("chargeId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_status_priority_idx" ON "MaintenanceRequest"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_unitId_idx" ON "MaintenanceRequest"("organizationId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_requestId_key" ON "WorkOrder"("requestId");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_status_idx" ON "WorkOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_assigneeMembershipId_idx" ON "WorkOrder"("organizationId", "assigneeMembershipId");

-- CreateIndex
CREATE INDEX "WorkOrderEvent_workOrderId_createdAt_idx" ON "WorkOrderEvent"("workOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_predecessorLeaseId_fkey" FOREIGN KEY ("predecessorLeaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One active lease per unit (not expressible in the Prisma schema).
CREATE UNIQUE INDEX "leases_one_active_per_unit" ON "Lease"("unitId") WHERE "status" = 'ACTIVE';
