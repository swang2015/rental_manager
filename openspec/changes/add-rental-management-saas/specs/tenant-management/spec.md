# Spec Delta

## Purpose

Keeps tenant contact records for each organization and connects a tenant record to a portal account so the tenant can self-serve without gaining manager access.

## ADDED Requirements

### Requirement: Tenant records

Managers SHALL create, view, update, and archive tenant records. A tenant record SHALL include a full name and email address and MAY include a phone number. Tenant email addresses SHALL be unique within an organization.

#### Scenario: Create a tenant
- **GIVEN** a signed-in property manager
- **WHEN** the manager submits a tenant name, email, and optional phone
- **THEN** the tenant appears in the organization's tenant list with no lease

#### Scenario: Duplicate tenant email is rejected
- **GIVEN** an organization with a tenant using `tenant@example.com`
- **WHEN** a manager creates another tenant with the same email
- **THEN** the system rejects the record and keeps the existing tenant unchanged

#### Scenario: Tenant with lease history cannot be deleted
- **GIVEN** a tenant referenced by any lease
- **WHEN** a manager attempts to delete the tenant
- **THEN** the system refuses deletion and offers to archive the tenant instead

### Requirement: Tenant portal invitation

Managers SHALL invite a tenant to the portal by email from the tenant record. Acceptance SHALL create or link a tenant account only for the invited email and SHALL link it to that tenant record. A tenant account SHALL be linked to at most one tenant record per organization.

#### Scenario: Tenant accepts portal invitation
- **GIVEN** a tenant record for `tenant@example.com` with no portal account
- **WHEN** the tenant accepts the invitation and sets a password
- **THEN** the tenant account is linked to that record and the record shows portal access as active

#### Scenario: Invitation is single-use
- **GIVEN** a tenant invitation that was already accepted
- **WHEN** the invitation link is opened again
- **THEN** the system reports that the invitation is no longer valid and does not create another account

#### Scenario: Unlink a tenant account
- **GIVEN** a tenant record linked to a portal account
- **WHEN** a property manager revokes portal access
- **THEN** the account can no longer sign in to that tenant's data and the record shows portal access as inactive

### Requirement: Tenant lease history

A tenant record SHALL show the tenant's leases across properties in the organization, ordered from newest to oldest, including the unit, lease period, and lease status.

#### Scenario: Tenant history lists past and current leases
- **GIVEN** a tenant with one ended lease and one active lease
- **WHEN** a manager opens the tenant record
- **THEN** both leases appear with the active lease listed first and clearly marked active

### Requirement: Tenant search

The tenant list SHALL be searchable by name, email, and phone, and filterable by portal status.

#### Scenario: Search by email
- **GIVEN** several tenant records
- **WHEN** a manager searches for a partial email address
- **THEN** only matching tenants are shown
