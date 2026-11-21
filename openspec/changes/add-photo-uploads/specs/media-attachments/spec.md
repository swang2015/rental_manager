# Spec Delta

## Purpose

Stores and serves photos attached to maintenance requests, keeping tenant images private and reachable only by principals who can already see the parent request.

## ADDED Requirements

### Requirement: Attachment ownership

Every attachment SHALL belong to exactly one organization and one maintenance request, and SHALL record its uploader, purpose, content type, byte size, and creation time. Purposes SHALL distinguish photos supplied with the reported issue from photos supplied as resolution evidence.

#### Scenario: Attachment records its context
- **GIVEN** a tenant attaches a photo to a maintenance request
- **WHEN** the attachment is stored
- **THEN** it is linked to that request and organization, records the uploader, and is marked as a reported-issue photo

#### Scenario: Attachment without a request is rejected
- **GIVEN** an upload completion request that names no existing maintenance request
- **WHEN** the system processes it
- **THEN** the upload is rejected and no attachment record is created

### Requirement: Upload authorization

A principal SHALL obtain a time-limited upload authorization only for a maintenance request they can already access, and only for an allowed image type within the configured size limit. Tenant principals SHALL upload only to requests belonging to their own tenancy. Manager and staff principals SHALL upload only within their own organization and only to requests they can view.

#### Scenario: Tenant uploads to their own request
- **GIVEN** a signed-in tenant with an open request
- **WHEN** the tenant requests an upload authorization for that request
- **THEN** the system returns a short-lived authorization scoped to one new object

#### Scenario: Tenant cannot upload to another tenant's request
- **GIVEN** a tenant and a request belonging to a different tenant in the same organization
- **WHEN** the first tenant requests an upload authorization for that request
- **THEN** the system denies the request and reveals nothing about the request

#### Scenario: Cross-organization upload is denied
- **GIVEN** a manager in organization A and a request in organization B
- **WHEN** the manager requests an upload authorization for that request
- **THEN** the system denies the request

#### Scenario: Unsupported content is refused before transfer
- **GIVEN** a client that declares a non-image content type or a file above the configured size limit
- **WHEN** it requests an upload authorization
- **THEN** the system refuses the authorization with a message naming the allowed types and size limit

### Requirement: Direct transfer to private storage

Photo content SHALL be transferred from the client directly to private object storage using a short-lived authorization scoped to a single object key. The bucket SHALL NOT permit anonymous read, anonymous list, or public object URLs. Object keys SHALL be unguessable and SHALL NOT contain tenant names, addresses, or other personal data.

#### Scenario: Browser uploads without proxying through the application
- **GIVEN** a valid upload authorization
- **WHEN** the client sends the compressed image to storage
- **THEN** storage accepts the object and the application server does not relay the file body

#### Scenario: Anonymous access to stored photos is denied
- **GIVEN** an object key for a stored photo
- **WHEN** an unauthenticated client requests the object without a signed URL
- **THEN** storage denies the request

#### Scenario: Object keys do not reveal personal data
- **GIVEN** a stored photo for a tenant at a named property
- **WHEN** an operator inspects the object key
- **THEN** the key contains only opaque identifiers and contains no tenant name, address, or email

### Requirement: Upload completion and validation

The system SHALL create an attachment record only after confirming that the stored object exists, decodes as an allowed image format, and is within the size and dimension limits. Before the photo is made available, the system SHALL normalize it by applying its orientation, removing metadata including location, and re-encoding it to a web-safe format. Repeating completion for the same upload SHALL NOT create a duplicate attachment.

#### Scenario: Valid upload becomes an attachment
- **GIVEN** a completed transfer of a valid JPEG within the limits
- **WHEN** the client reports the upload as complete
- **THEN** the photo becomes visible on the request and its metadata is recorded

#### Scenario: Disguised file is rejected
- **GIVEN** a file named as an image whose content is not a decodable image
- **WHEN** the client reports the upload as complete
- **THEN** the system rejects the upload and deletes the stored object

#### Scenario: Location metadata is removed
- **GIVEN** a photo carrying GPS coordinates in its metadata
- **WHEN** the photo is normalized
- **THEN** the stored photo contains no location metadata

#### Scenario: Completion is idempotent
- **GIVEN** an upload that has already been completed
- **WHEN** the client repeats the completion request
- **THEN** the system returns the existing attachment and creates no second record

### Requirement: Access-controlled retrieval

Photo content SHALL be retrievable only by principals allowed to view the parent request, and SHALL be delivered through a short-lived signed URL issued after an access check. Signed URLs SHALL expire and SHALL NOT grant access to any other object.

#### Scenario: Authorized manager views a photo
- **GIVEN** a manager in the request's organization
- **WHEN** the manager requests the photo
- **THEN** the system returns a signed URL that resolves to the image

#### Scenario: Unauthorized tenant is denied
- **GIVEN** a tenant who cannot view the request
- **WHEN** the tenant requests its photo
- **THEN** the system denies the request and issues no URL

#### Scenario: Expired URL stops working
- **GIVEN** a signed URL whose lifetime has elapsed
- **WHEN** it is used to fetch the photo
- **THEN** storage denies the request

### Requirement: Per-request attachment limits

The system SHALL enforce a configured maximum number of photos per maintenance request and a configured maximum size for each uploaded photo. The client SHALL be able to learn the limits and the remaining allowance before uploading.

#### Scenario: Limit is enforced
- **GIVEN** a request that already has the maximum number of photos
- **WHEN** a principal attempts to add another photo
- **THEN** the system refuses the upload and states the limit

#### Scenario: Remaining allowance is visible
- **GIVEN** a request with two of the maximum five photos
- **WHEN** the client opens the photo picker
- **THEN** the client is told that three more photos may be added

### Requirement: Retry and partial failure

A failed or interrupted upload SHALL be retryable without creating duplicate attachments. A maintenance request SHALL remain submitted and visible when one or more of its photos fail to upload, and the client SHALL be able to report which photos are pending or failed.

#### Scenario: Retry after a dropped connection
- **GIVEN** a photo upload that failed midway
- **WHEN** the client retries the same photo
- **THEN** the photo is stored once and appears once on the request

#### Scenario: Request survives photo failure
- **GIVEN** a tenant who submits a request and whose photo upload then fails
- **WHEN** the tenant returns to the request
- **THEN** the request is present with its text and shows the photo as failed with a retry action

### Requirement: Attachment removal

An uploader SHALL be able to remove their own photo while the request is still open, and a manager in the same organization SHALL be able to remove any photo on a request they can view. Removal SHALL delete the attachment record and the stored object.

#### Scenario: Uploader removes a mistaken photo
- **GIVEN** a tenant who attached the wrong photo to an open request
- **WHEN** the tenant removes it
- **THEN** the photo disappears from the request and its stored object is deleted

#### Scenario: Unrelated tenant cannot remove a photo
- **GIVEN** a tenant who cannot view a request
- **WHEN** the tenant attempts to remove one of its photos
- **THEN** the system denies the request and the photo remains

### Requirement: Abandoned upload cleanup

The system SHALL delete stored objects and pending metadata for uploads that were authorized but never completed within a configured window, and SHALL run this cleanup on a schedule without deleting completed attachments.

#### Scenario: Abandoned upload is removed
- **GIVEN** an upload authorization from before the cleanup window that was never completed
- **WHEN** cleanup runs
- **THEN** its stored object and pending metadata are deleted

#### Scenario: Completed attachment is preserved
- **GIVEN** a completed attachment older than the cleanup window
- **WHEN** cleanup runs
- **THEN** the attachment and its object remain available
