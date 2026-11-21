# Spec Delta

## Purpose

Gives managers a single operational snapshot of occupancy, rent collection, and maintenance workload so they can spot problems without opening each module.

## ADDED Requirements

### Requirement: Occupancy summary

The dashboard SHALL show total units, occupied units, available units, off-market units, and the occupancy rate for the organization. Values SHALL reflect the current unit status.

#### Scenario: Occupancy reflects unit status
- **GIVEN** 10 units of which 7 are occupied, 2 available, and 1 off-market
- **WHEN** a manager opens the dashboard
- **THEN** the occupancy summary shows those counts and a 70% occupancy rate

#### Scenario: Status change updates the summary
- **GIVEN** a dashboard showing 7 occupied units
- **WHEN** an active lease is terminated and the dashboard is refreshed
- **THEN** occupied units decrease by one and available units increase by one

### Requirement: Rent collection summary

The dashboard SHALL show, for the selected billing period, total billed, total collected, total outstanding, and the number of overdue charges. The period SHALL default to the current month and SHALL be changeable by month.

#### Scenario: Default to the current month
- **GIVEN** charges in the current month and previous months
- **WHEN** a manager opens the dashboard
- **THEN** the rent summary covers only the current month

#### Scenario: Change the reporting month
- **GIVEN** a dashboard showing the current month
- **WHEN** the manager selects the previous month
- **THEN** billed, collected, outstanding, and overdue figures are recalculated for that month

### Requirement: Maintenance summary

The dashboard SHALL show the count of open maintenance requests, broken down by priority, plus the count of requests that are unassigned or older than seven days.

#### Scenario: Unassigned requests are surfaced
- **GIVEN** three open requests, one of which has no assignee
- **WHEN** a manager opens the dashboard
- **THEN** the maintenance summary shows three open requests and one unassigned

### Requirement: Dashboard scoping and drill-down

Dashboard figures SHALL be scoped to the caller's organization. Each summary SHALL link to the corresponding filtered list, and the dashboard SHALL be filterable by property.

#### Scenario: Filter by property
- **GIVEN** an organization with two properties
- **WHEN** a manager filters the dashboard to one property
- **THEN** occupancy, rent, and maintenance figures include only that property's units, leases, charges, and requests

#### Scenario: Drill into overdue charges
- **GIVEN** a dashboard reporting four overdue charges
- **WHEN** the manager activates the overdue figure
- **THEN** the rent ledger opens filtered to those overdue charges
