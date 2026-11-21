# Proposal

## Why

Tenants report maintenance problems from their phones, where a photo explains the issue far better than text, but the product currently has no way to attach or view images. Requests arrive as prose, managers triage them over calls and chat, and staff cannot see the actual damage before arriving. Photo capture is the single most requested mobile capability and the main reason tenants would install the app-like experience.

## What Changes

- Add private photo attachments to maintenance requests: tenants can attach photos when reporting an issue; managers and assigned staff can view them and add resolution photos.
- Add a mobile-first capture flow that opens the phone camera or photo library, compresses images on the device, and uploads directly to Cloudflare R2.
- Add an attachment data model and access-controlled retrieval: every attachment belongs to one organization and one maintenance request, and is served only to principals who can already see that request.
- Add upload lifecycle handling: upload intents, completion, failure and retry, per-request count and size limits, and cleanup of abandoned uploads.
- Add storage configuration (bucket, credentials, signed URLs, bucket CORS) to environment and deployment setup, with an S3-compatible service for local development.

**Out of scope:** native mobile apps (this is a responsive web flow with camera capture), unit/property marketing galleries, lease document uploads, video or audio attachments, OCR/AI tagging, and public or shareable photo links.

## Capabilities

### New Capabilities

- `media-attachments`: storage-backed image attachments — upload authorization, direct-to-object-storage transfer, content validation, metadata, access-controlled retrieval, limits, retention, and cleanup.

### Modified Capabilities

- `maintenance-management`: maintenance requests gain photos from the reporter; managers and assigned staff can view them and attach resolution photos.
- `tenant-portal`: tenants can attach photos while reporting a maintenance issue and see those photos on their own request.

## Impact

- **Data:** new `attachments` table and migration; relations to organizations, users, and maintenance requests.
- **API:** new attachment endpoints (upload intent, complete, delete, download) alongside the existing `/api/v1` surface; reuses session and organization-scope guards.
- **UI:** reusable mobile photo picker and uploader, integration into the tenant request form, and a gallery on the manager request detail.
- **Dependencies:** S3 client and presigner (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) and `sharp` for server-side validation and normalization.
- **Configuration/ops:** R2 bucket and credentials, signed-URL TTL, bucket CORS for direct uploads, and a scheduled cleanup for abandoned uploads.
- **Sequencing:** builds on `add-rental-management-saas`; its organization scoping, authentication, maintenance, and tenant-portal surfaces are prerequisites.
- **Security/privacy:** photos show the inside of tenants' homes. The bucket stays private, EXIF location data is stripped, signed URLs are short-lived, and cross-organization or cross-tenant access is denied.
