# Spec Delta

## Purpose

Gives managers a single queue for repair requests, turns accepted requests into assignable work orders, and keeps status visible to the tenant who reported the issue.

## ADDED Requirements

### Requirement: Maintenance request queue

Every tenant-submitted maintenance request SHALL appear in the manager queue for the request's organization. Managers SHALL also be able to create a request on a tenant's behalf. The queue SHALL show the property, unit, tenant, category, priority, status, and age of each request.

#### Scenario: Tenant request appears for managers
- **GIVEN** a tenant submits a request for a leaking tap
- **WHEN** a property manager opens the maintenance queue
- **THEN** the request is listed with the tenant, unit, category, and submitted time

#### Scenario: Request is organization-scoped
- **GIVEN** a request from another organization
- **WHEN** a manager requests its detail by identifier
- **THEN** the system reveals nothing about the request

### Requirement: Request triage and priority

Managers SHALL set a request's priority to low, medium, or urgent and SHALL record an optional triage note. The tenant SHALL see the priority once it is set.

#### Scenario: Urgent priority is applied
- **GIVEN** a submitted request
- **WHEN** a manager sets the priority to urgent with a note
- **THEN** the request is marked urgent and the tenant's request view shows the priority

#### Scenario: Default priority
- **GIVEN** a newly submitted request
- **WHEN** no manager has triaged it
- **THEN** the request reports medium priority and an open status

### Requirement: Work orders and assignment

Managers SHALL convert an open request into a work order and assign it to a staff member. A work order SHALL reference one request, one assignee, and a scheduled date. Reassigning a work order SHALL retain a record of the previous assignee.

#### Scenario: Convert a request to a work order
- **GIVEN** an open request
- **WHEN** a manager creates a work order and assigns it to a staff member for a scheduled date
- **THEN** the request becomes in progress and the assignee sees the work order in their list

#### Scenario: Staff sees only assigned work
- **GIVEN** a staff member assigned to one work order and not another
- **WHEN** the staff member opens their work list
- **THEN** only the assigned work order is listed

#### Scenario: Reassignment is recorded
- **GIVEN** a work order assigned to staff member A
- **WHEN** a manager reassigns it to staff member B
- **THEN** staff member B becomes the current assignee and the prior assignment remains in the work order history

### Requirement: Status updates and resolution

Managers or the assigned staff member SHALL update a work order through scheduled, in progress, resolved, and closed states. Resolving a work order SHALL require a resolution note. Resolving or closing SHALL update the linked tenant request to the same state.

#### Scenario: Resolve with a note
- **GIVEN** an in-progress work order
- **WHEN** the assignee marks it resolved with a note describing the repair
- **THEN** the work order and linked request become resolved and the tenant sees the note

#### Scenario: Resolution note is required
- **GIVEN** an in-progress work order
- **WHEN** the assignee attempts to resolve it without a note
- **THEN** the system rejects the update and keeps the work order in progress

#### Scenario: Closed work is final
- **GIVEN** a resolved work order
- **WHEN** the assignee closes it
- **THEN** the work order and request become closed and further status edits are rejected

### Requirement: Request cancellation

Managers SHALL cancel a request that will not be worked on, recording a reason. Cancelling SHALL close any linked open work order and SHALL show the reason to the tenant.

#### Scenario: Cancel a request with a reason
- **GIVEN** an open request
- **WHEN** a manager cancels it with the reason "duplicate report"
- **THEN** the request becomes cancelled and the tenant sees that reason

### Requirement: Maintenance list filtering

The maintenance queue SHALL be filterable by property, status, priority, category, and assignee, and searchable by tenant name and request description.

#### Scenario: Filter to urgent open work
- **GIVEN** requests in several priorities and statuses
- **WHEN** a manager filters by urgent priority and open status
- **THEN** only urgent open requests are listed
