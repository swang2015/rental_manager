# Spec Delta

## ADDED Requirements

### Requirement: Photos on maintenance requests

A maintenance request SHALL carry zero or more photos supplied by the reporter. Managers SHALL see the photo count in the request queue and the photos themselves on the request detail. Photos SHALL be optional so that a request can still be submitted from a device without a camera or with uploads unavailable.

#### Scenario: Request shows reporter photos
- **GIVEN** a tenant submits a request with three photos
- **WHEN** a manager opens the request detail
- **THEN** all three photos are shown in the order they were attached

#### Scenario: Queue shows photo count
- **GIVEN** one request with photos and one without
- **WHEN** a manager views the maintenance queue
- **THEN** the first request shows a photo count and the second shows none

#### Scenario: Request without photos is valid
- **GIVEN** a tenant with a device that cannot upload photos
- **WHEN** the tenant submits a text-only request
- **THEN** the request is accepted normally

### Requirement: Resolution photos

The assigned staff member or a manager SHALL be able to attach photos as resolution evidence before a work order is resolved. Resolution photos SHALL be visible to the tenant who reported the issue and SHALL be distinguishable from photos supplied with the report.

#### Scenario: Staff attach a completion photo
- **GIVEN** a work order in progress
- **WHEN** the assigned staff member attaches a photo of the repaired fixture and resolves the work order
- **THEN** the tenant sees the resolution photo on the request, labeled as resolution evidence

#### Scenario: Photos are not required to resolve
- **GIVEN** a work order without any resolution photo
- **WHEN** the assigned staff member resolves it with a resolution note
- **THEN** the work order resolves normally

### Requirement: Photo access follows request access

Access to a request's photos SHALL be governed by access to the request itself: managers within the request's organization, the staff member assigned to its work order, and the tenant whose request it is. No other principal SHALL be able to list or retrieve a request's photos.

#### Scenario: Staff member sees photos on assigned work
- **GIVEN** a staff member assigned to a work order
- **WHEN** the staff member opens the work order
- **THEN** the photos attached to its request are visible

#### Scenario: Staff member without access is denied
- **GIVEN** a staff member in the organization who is neither assigned to the work order nor a manager
- **WHEN** the staff member requests the request's photos
- **THEN** the system denies access
