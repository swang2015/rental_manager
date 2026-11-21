# Spec Delta

## Purpose

Tracks what each tenant owes and has paid, so managers can see outstanding rent and tenants can see their balance without relying on spreadsheets.

## ADDED Requirements

### Requirement: Monthly rent charges

The system SHALL generate one rent charge per active lease for each monthly billing period, using the lease's rent amount and a due date derived from the lease's due day. Generating a charge for a lease and period that already has one SHALL NOT create a duplicate.

#### Scenario: Charge generated for a new period
- **GIVEN** an active lease with rent 1,200 and due day 5
- **WHEN** the billing period starting 1 June is generated
- **THEN** one charge for 1,200 falls due on 5 June and is marked unpaid

#### Scenario: Duplicate generation is prevented
- **GIVEN** an active lease that already has a June charge
- **WHEN** June charges are generated again
- **THEN** no second June charge is created and the existing charge is unchanged

#### Scenario: Ended lease stops generating charges
- **GIVEN** a lease that ended on 30 April
- **WHEN** charges are generated for May
- **THEN** no May charge is created for that lease

### Requirement: Record payments

Managers SHALL record a payment against a rent charge with an amount, payment date, method, and optional reference. A payment SHALL NOT exceed the charge's outstanding balance.

#### Scenario: Partial payment
- **GIVEN** an unpaid charge of 1,200
- **WHEN** a manager records a payment of 500
- **THEN** the charge shows a balance of 700 and a status of partial

#### Scenario: Full payment
- **GIVEN** a charge with a balance of 700
- **WHEN** a manager records a payment of 700
- **THEN** the charge shows a zero balance and a status of paid

#### Scenario: Overpayment is rejected
- **GIVEN** a charge with a balance of 500
- **WHEN** a manager attempts to record a payment of 600
- **THEN** the system rejects the payment and leaves the charge unchanged

### Requirement: Charge status and overdue detection

Each charge SHALL report one status: unpaid, partial, paid, or overdue. A charge with a positive balance past its due date SHALL be overdue. Status SHALL update automatically when the due date passes or a payment is recorded.

#### Scenario: Unpaid charge becomes overdue
- **GIVEN** an unpaid charge due yesterday
- **WHEN** the charge is viewed today
- **THEN** its status is overdue and the days late are shown

#### Scenario: Overdue charge is cleared by payment
- **GIVEN** an overdue charge with a balance of 300
- **WHEN** a manager records the remaining 300
- **THEN** the charge status becomes paid

### Requirement: Adjustments and waivers

Managers SHALL record an adjustment against a charge with a reason. A waiver SHALL reduce the outstanding balance without creating a payment record. An adjustment SHALL NOT reduce the balance below zero.

#### Scenario: Waive part of a charge
- **GIVEN** an unpaid charge of 1,200
- **WHEN** a manager records a 200 waiver for a repair credit
- **THEN** the charge balance becomes 1,000 and the reason is retained

#### Scenario: Waiver cannot exceed the balance
- **GIVEN** a charge with a balance of 100
- **WHEN** a manager attempts a 150 waiver
- **THEN** the system rejects the adjustment and keeps the balance at 100

### Requirement: Rent ledger views

Managers SHALL view charges and payments filtered by billing period, status, property, and tenant, with totals for billed, collected, and outstanding amounts. Tenants SHALL see only their own charges and payments.

#### Scenario: Manager filters overdue charges
- **GIVEN** charges in several statuses
- **WHEN** a manager filters the ledger to overdue
- **THEN** only overdue charges are listed and the outstanding total matches those rows

#### Scenario: Tenant ledger is self-scoped
- **GIVEN** two tenants in one organization with separate charges
- **WHEN** one tenant opens the rent ledger
- **THEN** only that tenant's charges and payments are visible
