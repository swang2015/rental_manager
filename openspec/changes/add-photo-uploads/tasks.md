# Tasks

## 1. Storage foundation

- [ ] 1.1 Add `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, and `sharp` dependencies, and verify `npm run typecheck` and `npm run build` pass with them installed
- [ ] 1.2 Extend environment validation with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `ATTACHMENT_MAX_BYTES`, `ATTACHMENT_MAX_PER_REQUEST`, `ATTACHMENT_UPLOAD_TTL_SECONDS`, and `ATTACHMENT_URL_TTL_SECONDS`, and verify startup fails with a clear error when one is missing
- [ ] 1.3 Implement the S3 client and presigner module for R2, and verify a unit test proves keys, endpoint, and region are derived from configuration
- [ ] 1.4 Add a Docker Compose MinIO service with a pre-created private bucket and document the local env values in `.env.example`, and verify `docker compose up` then a presigned PUT/GET round trip succeeds against it
- [ ] 1.5 Write `docs/photo-storage.md` covering bucket privacy, CORS rules, credentials, signed URL lifetimes, and local MinIO setup, and verify every documented command runs as written

## 2. Attachment data model

- [ ] 2.1 Add the `Attachment` model with `AttachmentPurpose` and `AttachmentStatus` enums, relations, and indexes per `design.md`, and verify `npx prisma validate` and `npm run db:migrate` succeed on a clean database
- [ ] 2.2 Add attachment relations to `Organization`, `User`, and `MaintenanceRequest`, and verify `npx prisma generate` and `npm run typecheck` pass
- [ ] 2.3 Implement org-scoped attachment repository functions (create pending, mark ready, list by request, load by id, delete), and verify integration tests prove a foreign organization id returns nothing for every function
- [ ] 2.4 Add attachment cleanup indexes and confirm the migration includes them, and verify `EXPLAIN` on the pending-sweep query uses the `(status, created_at)` index

## 3. Upload authorization

- [ ] 3.1 Implement `canViewRequest` / `canContributePhotos` in the domain layer for manager, assigned staff, and owning tenant, and verify unit tests cover the full permission matrix
- [ ] 3.2 Implement `POST /api/v1/maintenance-requests/{id}/attachments/intents` with purpose, content-type, size, request-status, and per-request count validation, and verify integration tests cover each rejection with its status code
- [ ] 3.3 Implement the object key builder with opaque ids, and verify a unit test asserts the key contains organization, request, and attachment ids and none of the tenant's name, email, or address
- [ ] 3.4 Add per-user rate limiting to the intent endpoint reusing the existing limiter, and verify a burst above the threshold is rejected without creating rows or objects
- [ ] 3.5 Verify a tenant cannot mint an intent for another tenant's request, a manager cannot mint one across organizations, and an unassigned staff member cannot mint one for an assigned work order, via integration tests

## 4. Upload completion and normalization

- [ ] 4.1 Implement `POST /api/v1/attachments/{id}/complete` with `HeadObject` existence, content-type, and size checks, and verify oversize or missing objects are deleted and reported
- [ ] 4.2 Implement `sharp` normalization (orientation, 2000 px cap, metadata strip, JPEG q82) and verify an EXIF-GPS fixture is stored without GPS tags and with correct dimensions
- [ ] 4.3 Verify a non-image payload named as a JPEG is rejected by decode and its object removed, with a test using a text fixture
- [ ] 4.4 Make completion idempotent by returning the existing `READY` attachment, and verify a repeated completion creates no second row
- [ ] 4.5 Ensure a failed completion leaves no `READY` row and the pending row remains sweepable, and verify with a forced normalization failure

## 5. Retrieval, access control, and removal

- [ ] 5.1 Implement `GET /api/v1/attachments/{id}` that checks request visibility and responds `302` to a 5-minute signed URL with `Cache-Control: private, max-age=240` and `Referrer-Policy: same-origin`, and verify authorized principals get a working URL
- [ ] 5.2 Verify denied retrieval for another tenant, an unassigned staff member, and another organization, and verify a signed URL stops working after its TTL
- [ ] 5.3 Implement `DELETE /api/v1/attachments/{id}` allowing the uploader while the request is open and a manager at any time, and verify the row and object are both removed
- [ ] 5.4 Verify deleting through a principal without request access is denied and leaves the object intact

## 6. Mobile photo capture component

- [ ] 6.1 Build the client photo picker with `accept="image/*"`, `capture`, multi-select, previews, and removal, and verify it renders usable controls at a 375 px viewport with 44 px touch targets
- [ ] 6.2 Implement canvas compression with `createImageBitmap` (with an `<img>` fallback), 2000 px longest edge, and JPEG 0.82 output, and verify a 4000 px fixture produces a ≤ 2000 px JPEG and a HEIC fixture becomes JPEG on Safari
- [ ] 6.3 Implement sequential upload with `XMLHttpRequest` progress and per-photo retry, and verify progress reaches 100% and a forced network error exposes the retry action
- [ ] 6.4 Handle unsupported or undecodable files with an actionable message instead of a broken preview, and verify a text file selected as an image is rejected before upload
- [ ] 6.5 Revoke object URLs on removal and unmount, and verify with a component test that no leaked blob URLs remain after unmount

## 7. Tenant portal integration

- [ ] 7.1 Integrate the picker into the maintenance request form so photos are selected and previewed before submission, and verify a submitted request shows its attached photos
- [ ] 7.2 Upload selected photos after the request is created, showing per-photo and overall progress, and verify the request is visible even when every upload fails
- [ ] 7.3 Add the failed-photo banner and retry flow on the request detail, and verify a reload preserves the failed state until retry succeeds
- [ ] 7.4 Show reporter and resolution photos on the tenant's own request with a resolution label, and verify a tenant never receives another tenant's photo ids or URLs
- [ ] 7.5 Add an end-to-end mobile-viewport test that submits a request with two fixture photos and asserts both render, and verify it passes in Playwright

## 8. Manager and staff integration

- [ ] 8.1 Show a photo-count badge in the maintenance queue, and verify counts match the request detail for requests with zero, one, and five photos
- [ ] 8.2 Add the photo grid and lightbox to the manager request detail, and verify all photos load through the authorized route and none through a public URL
- [ ] 8.3 Add "add resolution photo" for the assigned staff member and managers before resolving, and verify the photo is labeled as resolution evidence for the tenant
- [ ] 8.4 Verify an unassigned staff member cannot see a request's photos while the assigned staff member can, via an integration test and a UI check

## 9. Cleanup and operations

- [ ] 9.1 Implement `POST /api/v1/internal/attachments/cleanup` guarded by `CRON_SECRET`, deleting pending rows and objects older than 24 hours, and verify old pending uploads are removed while old `READY` attachments remain
- [ ] 9.2 Make the sweep idempotent and bounded, and verify two consecutive runs delete nothing on the second run and complete within the configured batch size
- [ ] 9.3 Configure the daily schedule in the deployment setup, and verify one scheduled run logs a summary without signed URLs or credentials
- [ ] 9.4 Document cleanup, bucket alerts, and the rollback procedure (hide pickers, pause cleanup) in `docs/photo-storage.md`, and verify the steps match the deployed configuration

## 10. Integration and safety checks

- [ ] 10.1 Verify anonymous access cannot read or list the bucket, and that a stored photo key is not derived from tenant data
- [ ] 10.2 Verify the five-photo and 15 MB limits end to end, including the client message and the remaining-allowance display
- [ ] 10.3 Verify request submission still succeeds with uploads unavailable, and that photo retry after reconnecting produces exactly one attachment
- [ ] 10.4 Measure a five-photo upload on a throttled mobile profile, confirm each compressed photo is under 1 MB, and record the result in `docs/photo-storage.md`

## Workflow follow-up

- Archive the change after review and after `openspec validate add-photo-uploads --strict` passes.
- Confirm the archived `media-attachments` spec has its Purpose copied into `openspec/specs/`.
