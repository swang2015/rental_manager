# Spec Delta

## Purpose

Defines organizations, membership, roles, invitations, and authentication so every person acts inside one organization with least-privilege access and tenant users only reach their own records.

## ADDED Requirements

### Requirement: Organization membership and roles

Every manager account SHALL act through a membership in exactly one active organization. A membership SHALL carry exactly one role: owner, property manager, or staff. Tenant accounts SHALL be linked to a tenant record and SHALL NOT hold an organization membership.

#### Scenario: Manager works inside an organization
- **GIVEN** a signed-in user with a property manager membership in "Sunrise Rentals"
- **WHEN** the user opens the manager workspace
- **THEN** the workspace shows only Sunrise Rentals data and the role is visible in the account menu

#### Scenario: Tenant account has no manager role
- **GIVEN** a signed-in tenant linked to a tenant record
- **WHEN** the tenant requests a manager-only page
- **THEN** the system denies access and does not reveal manager data

### Requirement: Invitation-based onboarding

Owners and property managers SHALL invite managers by email address. An invitation SHALL grant access only after the invitee accepts it while signed in with the invited email. Invitations SHALL expire and SHALL be revocable before acceptance.

#### Scenario: Invitee accepts a valid invitation
- **GIVEN** a pending invitation for `manager@example.com` as staff
- **WHEN** a user signed in as `manager@example.com` accepts the invitation
- **THEN** the membership becomes active with the staff role and the invitation can no longer be reused

#### Scenario: Expired invitation is rejected
- **GIVEN** an invitation whose expiry time has passed
- **WHEN** the invitee attempts to accept it
- **THEN** the system rejects the invitation and offers to request a new one

#### Scenario: Invitation email must match
- **GIVEN** an invitation for `manager@example.com`
- **WHEN** a user signed in as another address attempts to accept it
- **THEN** the system rejects the acceptance and leaves the invitation pending

### Requirement: Authentication and sessions

The system SHALL authenticate users with an email address and password and SHALL keep an authenticated session until the user signs out or the session expires. Unauthenticated requests to protected pages SHALL be redirected to sign-in.

#### Scenario: Successful sign-in
- **GIVEN** a registered user with a valid password
- **WHEN** the user submits the correct email and password
- **THEN** the system starts a session and opens the workspace for the user's role

#### Scenario: Invalid credentials
- **GIVEN** a registered user
- **WHEN** the user submits an incorrect password
- **THEN** the system rejects the sign-in with a generic error and does not start a session

#### Scenario: Sign-out ends the session
- **GIVEN** a signed-in user
- **WHEN** the user signs out
- **THEN** the session is invalidated and protected pages redirect to sign-in

### Requirement: Organization-scoped data isolation

Every read and write of organization-owned data SHALL be limited to the caller's active organization. A request that targets a record outside that organization SHALL be rejected without disclosing whether the record exists.

#### Scenario: Cross-organization record is not accessible
- **GIVEN** a property belonging to organization A
- **WHEN** a signed-in member of organization B requests that property by identifier
- **THEN** the system responds as if the record does not exist and reveals no property data

#### Scenario: Tenant sees only their own records
- **GIVEN** a tenant linked to one lease in organization A
- **WHEN** the tenant requests another tenant's lease in the same organization
- **THEN** the system denies access and reveals no lease data

### Requirement: Role-based permissions

Owners SHALL manage organization settings and members. Property managers SHALL manage properties, tenants, leases, rent, and maintenance. Staff SHALL only act on operational work assigned to them. The system SHALL deny any action outside the caller's role.

#### Scenario: Staff cannot manage members
- **GIVEN** a signed-in staff member
- **WHEN** the member attempts to invite another manager
- **THEN** the system denies the action and keeps the member list unchanged

#### Scenario: Owner can change a member role
- **GIVEN** a signed-in owner viewing an active staff member
- **WHEN** the owner changes the role to property manager
- **THEN** the member gains property manager permissions on the next request
