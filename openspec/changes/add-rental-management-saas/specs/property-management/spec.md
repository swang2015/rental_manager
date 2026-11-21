# Spec Delta

## Purpose

Lets managers record the physical rental portfolio — properties and their rentable units — and keeps unit occupancy status consistent with the lease lifecycle.

## ADDED Requirements

### Requirement: Property registry

Managers SHALL create, view, update, and archive properties. A property SHALL have a name and a street address, and MAY have notes. Property lists SHALL be scoped to the caller's organization and show each property's unit count and occupied unit count.

#### Scenario: Create a property
- **GIVEN** a signed-in property manager
- **WHEN** the manager submits a property name and address
- **THEN** the property appears in the organization's property list with zero units

#### Scenario: Property requires a name and address
- **GIVEN** a property form with a blank address
- **WHEN** the manager submits the form
- **THEN** the system rejects the submission and keeps the entered values

#### Scenario: Archived property leaves active lists
- **GIVEN** a property with no active leases
- **WHEN** a manager archives the property
- **THEN** it disappears from the active property list and remains available in archived filters

### Requirement: Unit registry

Managers SHALL add, edit, and remove units within a property. A unit SHALL have a label unique within its property, a bedroom count, a bathroom count, and a monthly rent amount. Removing a unit SHALL be allowed only when it has no lease history.

#### Scenario: Add a unit to a property
- **GIVEN** an existing property
- **WHEN** a manager adds unit "2B" with two bedrooms, one bathroom, and a monthly rent
- **THEN** unit "2B" appears under the property as available

#### Scenario: Duplicate unit label is rejected
- **GIVEN** a property that already has unit "2B"
- **WHEN** a manager adds another unit labeled "2B" to that property
- **THEN** the system rejects the new unit and explains that the label is already used

#### Scenario: Unit with lease history cannot be removed
- **GIVEN** a unit referenced by any lease, active or ended
- **WHEN** a manager attempts to remove the unit
- **THEN** the system refuses removal and offers to archive the unit instead

### Requirement: Unit occupancy status

Each unit SHALL report one status: available, occupied, or off-market. A unit SHALL become occupied when a lease for it is activated and available when that lease ends. A manager SHALL be able to mark a unit off-market only while it has no active lease.

#### Scenario: Lease activation occupies the unit
- **GIVEN** an available unit and a draft lease for that unit
- **WHEN** the lease is activated
- **THEN** the unit status becomes occupied

#### Scenario: Lease termination frees the unit
- **GIVEN** an occupied unit with an active lease
- **WHEN** the active lease is terminated
- **THEN** the unit status becomes available

#### Scenario: Off-market blocked during a lease
- **GIVEN** a unit with an active lease
- **WHEN** a manager attempts to mark the unit off-market
- **THEN** the system rejects the change and keeps the unit occupied

### Requirement: Portfolio filtering

Property and unit lists SHALL be filterable by property, occupancy status, and a text search over property name, address, and unit label.

#### Scenario: Filter units by occupancy
- **GIVEN** an organization with available and occupied units
- **WHEN** a manager filters the unit list to occupied
- **THEN** only occupied units are shown and the result count reflects the filter
