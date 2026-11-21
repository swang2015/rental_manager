# Spec Delta

## Purpose

Manages the lease lifecycle that connects a tenant to a unit, drives unit occupancy, and provides the terms that rent billing and the tenant portal rely on.

## ADDED Requirements

### Requirement: Lease draft creation

Managers SHALL create a draft lease by selecting an available unit, a tenant, a start date, an end date, a monthly rent amount, a security deposit amount, and a rent due day between 1 and 28. The end date SHALL be after the start date.

#### Scenario: Create a draft lease
- **GIVEN** an available unit and a tenant record
- **WHEN** a manager submits valid lease terms
- **THEN** a draft lease is created, the unit remains available, and the lease appears in the lease list

#### Scenario: Invalid lease dates are rejected
- **GIVEN** a lease form whose end date is before its start date
- **WHEN** the manager submits the form
- **THEN** the system rejects the submission and keeps the draft unsaved

#### Scenario: Lease requires an available unit
- **GIVEN** a unit with an active lease
- **WHEN** a manager attempts to create another lease for that unit
- **THEN** the system rejects the new lease and identifies the active lease

### Requirement: Lease activation

Activating a draft lease SHALL set the lease status to active, make the unit occupied, and make the lease visible in the tenant's portal. A unit SHALL have at most one active lease at any time.

#### Scenario: Activate a draft lease
- **GIVEN** a draft lease for an available unit
- **WHEN** a manager activates the lease
- **THEN** the lease becomes active, the unit becomes occupied, and the tenant can see the lease in the portal

#### Scenario: Concurrent activation is prevented
- **GIVEN** two draft leases for the same unit
- **WHEN** one lease is activated and activation of the other is attempted
- **THEN** the second activation is rejected and it remains a draft

### Requirement: Lease term changes

Managers SHALL be able to edit a draft lease's terms. Managers SHALL be able to extend an active lease's end date without ending the lease. Changes to an active lease's rent amount SHALL take effect from the next billing period and SHALL NOT alter charges already generated.

#### Scenario: Extend an active lease
- **GIVEN** an active lease ending on 31 May
- **WHEN** a manager changes the end date to 31 July
- **THEN** the lease remains active, the unit remains occupied, and the new end date is shown

#### Scenario: Rent change preserves prior charges
- **GIVEN** an active lease with a generated charge for the current month
- **WHEN** a manager changes the monthly rent
- **THEN** the existing charge keeps its original amount and later charges use the new amount

### Requirement: Lease renewal

Renewing a lease SHALL create a draft successor lease for the same unit and tenant with a new period, leaving the current lease active until the successor is activated. Activating the successor SHALL end the current lease at its end date.

#### Scenario: Renewal creates a successor draft
- **GIVEN** an active lease
- **WHEN** a manager renews it with a new end date
- **THEN** a draft successor lease exists and the current lease stays active

#### Scenario: Successor activation closes the prior lease
- **GIVEN** an active lease and its draft successor
- **WHEN** the successor is activated
- **THEN** the prior lease becomes ended and the successor becomes the unit's active lease

### Requirement: Lease termination

Managers SHALL terminate an active lease by recording an end date and a reason. Termination SHALL set the lease status to ended and make the unit available.

#### Scenario: Terminate an active lease
- **GIVEN** an active lease for an occupied unit
- **WHEN** a manager terminates the lease with an end date and reason
- **THEN** the lease becomes ended, the unit becomes available, and the end date and reason are retained

#### Scenario: Terminated lease remains visible
- **GIVEN** a terminated lease
- **WHEN** a manager or the tenant views lease history
- **THEN** the terminated lease and its final terms are still available
