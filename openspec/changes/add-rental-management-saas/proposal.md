# Proposal

## Why

Small landlords and property managers run rentals on spreadsheets, chat threads, and paper receipts. Tenants have no reliable place to check their lease terms, rent balance, or repair status. This change introduces a multi-tenant SaaS web application that centralizes the rental lifecycle for managers and gives tenants a self-service portal, while keeping each organization's data isolated.

## What Changes

- Add a multi-tenant SaaS foundation: organizations, member invitations, role-based access (owner, property manager, staff), tenant accounts, and strict per-organization data isolation.
- Add a manager workspace covering the core rental lifecycle:
  - Property and unit registry with occupancy status.
  - Tenant records and portal invitations.
  - Lease creation, activation, renewal, and termination.
  - Rent charges, invoices, payment recording, and outstanding balances.
  - Maintenance requests triaged into work orders with status tracking.
  - An operations dashboard summarizing occupancy and rent status.
- Add a tenant portal where a tenant can view their lease, rent history and balance, and submit and follow maintenance requests.
- Add authentication and invitation flows for managers and tenants.
- Establish the application stack: Next.js (App Router) + TypeScript + Tailwind CSS, PostgreSQL with Prisma, and server-side authorization on every request.

**Out of scope for this change:** online payment processing (payments are recorded, not collected), accounting/tax reporting, document e-signature and file storage beyond lease links, email/SMS notification delivery, mobile apps, and a public marketing/listing site.

## Capabilities

### New Capabilities

- `identity-and-access`: Authentication, invitations, organization membership, roles, and organization-scoped authorization.
- `property-management`: Properties and units, their attributes, and occupancy status.
- `tenant-management`: Tenant profiles, contact details, and linkage to portal accounts.
- `lease-management`: Lease lifecycle from draft to active to terminated, with terms and unit assignment.
- `rent-billing`: Rent charges, invoices, payment records, balances, and overdue status.
- `maintenance-management`: Maintenance requests, work orders, assignment, and status workflow.
- `tenant-portal`: Tenant-facing self-service views and actions scoped to the tenant's own lease and unit.
- `operations-dashboard`: Cross-domain summary of occupancy, rent collection, and open maintenance work for managers.

### Modified Capabilities

_None. This is a greenfield project with no existing capability specs._

## Impact

- **New codebase:** application shell, routing, UI components, server actions/route handlers, and database schema.
- **Data:** new PostgreSQL schema and migrations for organizations, users, memberships, invitations, properties, units, tenants, leases, rent charges, payments, maintenance requests, and work orders.
- **Dependencies:** Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, and an authentication/session library.
- **Security:** every query and mutation must be scoped to the caller's organization and role; tenant users must only reach their own lease, balance, and requests.
- **Operations:** local development database, environment configuration, and migration workflow.
