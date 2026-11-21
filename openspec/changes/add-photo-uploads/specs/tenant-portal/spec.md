# Spec Delta

## ADDED Requirements

### Requirement: Reporting an issue with photos

A tenant SHALL be able to add photos while reporting a maintenance issue, using the device camera or the photo library, and SHALL be able to preview and remove each photo before submitting. Submission SHALL require a valid request description even when photos are attached.

#### Scenario: Tenant takes a photo while reporting
- **GIVEN** a tenant reporting a leaking pipe on a phone
- **WHEN** the tenant chooses the camera option and takes a picture
- **THEN** a preview of the picture appears in the reporting form before submission

#### Scenario: Tenant removes a chosen photo
- **GIVEN** a tenant who has chosen two photos
- **WHEN** the tenant removes one before submitting
- **THEN** only the remaining photo is attached to the submitted request

#### Scenario: Description is still required
- **GIVEN** a tenant who attached a photo but left the description empty
- **WHEN** the tenant submits
- **THEN** the request is rejected with a description-required message and the chosen photo is kept

### Requirement: Photo upload progress and recovery

The tenant portal SHALL show each photo's upload state and SHALL allow retrying a failed photo without re-entering the request. Leaving the page and returning to the request SHALL show the same pending or failed state so the tenant can finish the upload later.

#### Scenario: Upload failure is visible and recoverable
- **GIVEN** a tenant submits a request and the photo upload fails
- **WHEN** the tenant opens the request again
- **THEN** the request shows the failed photo with a retry action

#### Scenario: Successful retry clears the warning
- **GIVEN** a failed photo with a retry action
- **WHEN** the tenant retries and the upload succeeds
- **THEN** the photo is shown as attached and the failure warning disappears

### Requirement: Tenant views their request photos

A tenant SHALL see all photos on their own request, including reporter photos and resolution photos, and SHALL NOT see photos belonging to any other tenant's request.

#### Scenario: Tenant sees resolution evidence
- **GIVEN** a resolved request with a repair photo added by staff
- **WHEN** the tenant opens the request
- **THEN** the repair photo is visible and identified as resolution evidence

#### Scenario: Other tenant's photos stay hidden
- **GIVEN** two tenants with separate requests
- **WHEN** one tenant opens their own request
- **THEN** only photos belonging to that request are shown
