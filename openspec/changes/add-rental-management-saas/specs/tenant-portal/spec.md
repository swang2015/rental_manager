# Spec Delta

## Purpose

Gives tenants a self-service view of their own lease, rent, and maintenance history, and a way to report repair issues without contacting the manager directly.

## ADDED Requirements

### Requirement: Tenant home

After sign-in, a tenant SHALL land on a home page showing their current unit, lease period, next rent due date and amount, outstanding balance, and open maintenance requests. The page SHALL contain only the tenant's own data.

#### Scenario: Tenant home shows current tenancy
- **GIVEN** a tenant with an active lease, an unpaid charge due next week, and one open request
- **WHEN** the tenant signs in
- **THEN** the home page shows the unit, lease period, next amount due, outstanding balance, and open request count

#### Scenario: Tenant without an active lease
- **GIVEN** a tenant whose lease has ended
- **WHEN** the tenant signs in
- **THEN** the home page states that there is no active lease and shows lease history instead of upcoming rent

### Requirement: Lease details for tenants

A tenant SHALL view the full terms of their current lease and their past leases, including unit, start and end dates, monthly rent, deposit, and status. A tenant SHALL NOT view another tenant's lease.

#### Scenario: View current lease
- **GIVEN** a tenant with an active lease
- **WHEN** the tenant opens the lease page
- **THEN** the lease terms are shown with the active status

#### Scenario: Another tenant's lease is inaccessible
- **GIVEN** two tenants in the same organization
- **WHEN** one tenant requests the other tenant's lease by identifier
- **THEN** the system denies access and reveals no lease data

### Requirement: Tenant rent view

A tenant SHALL view their own charges and payments, including amount, due date, status, balance, and payment history. A tenant SHALL NOT record or modify payments or adjustments.

#### Scenario: Tenant sees an overdue balance
- **GIVEN** a tenant with an overdue charge
- **WHEN** the tenant opens the rent page
- **THEN** the charge is marked overdue with its outstanding balance and due date

#### Scenario: Tenant cannot record a payment
- **GIVEN** a signed-in tenant
- **WHEN** the tenant attempts to submit a payment record
- **THEN** the system denies the action and no payment is created

### Requirement: Tenant maintenance submission

A tenant SHALL submit a maintenance request for their current unit with a category and a description. The request SHALL record the submitting tenant and unit. A tenant without an active lease SHALL NOT submit a request.

#### Scenario: Submit a repair request
- **GIVEN** a tenant with an active lease
- **WHEN** the tenant submits a request describing a broken heater
- **THEN** the request is created as open with medium priority and appears in the tenant's request list

#### Scenario: Description is required
- **GIVEN** the maintenance form with an empty description
- **WHEN** the tenant submits it
- **THEN** the system rejects the submission and keeps the form open

#### Scenario: Former tenant cannot submit
- **GIVEN** a tenant whose lease has ended
- **WHEN** the tenant attempts to submit a request
- **THEN** the system denies the submission and explains that an active lease is required

### Requirement: Tenant maintenance tracking

A tenant SHALL see the status, priority, assignee role, scheduled date, and resolution note for each of their requests, and SHALL see the full status history. A tenant SHALL NOT change status or assignment.

#### Scenario: Track a request to resolution
- **GIVEN** a tenant request that was triaged and resolved
- **WHEN** the tenant opens the request
- **THEN** the current status, scheduled date, and resolution note are shown with the status history

#### Scenario: Tenant cannot edit status
- **GIVEN** a signed-in tenant
- **WHEN** the tenant attempts to mark a request resolved
- **THEN** the system denies the action and the request status is unchanged

### Requirement: Tenant contact details

A tenant SHALL update their own phone number in the portal. Changes to name or email SHALL require manager action.

#### Scenario: Update phone number
- **GIVEN** a signed-in tenant
- **WHEN** the tenant saves a new phone number
- **THEN** the new number appears on the tenant record visible to managers

#### Scenario: Email change is blocked
- **GIVEN** a signed-in tenant
- **WHEN** the tenant attempts to change the account email
- **THEN** the system rejects the change and directs the tenant to contact the manager
