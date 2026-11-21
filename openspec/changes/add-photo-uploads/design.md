# Design

## Context

See `proposal.md` — Why. This change lands on top of `add-rental-management-saas`: Next.js App Router, Prisma/PostgreSQL, database sessions in an `HttpOnly` cookie, and organization scoping through `scopedDb(orgId)`. Maintenance requests and work orders already exist; there is no attachment table, no storage client, and no upload surface. The repository currently contains only `src/lib` (auth, scoped DB, domain dates/errors) and the Prisma schema, so this design also defines the first `/api/v1` route handlers and the first client-side upload component.

Deployment target is not fixed between a long-running Node server and a serverless platform. The approach must work in both, which rules out writing files to local disk and proxying large bodies through the app.

## Goals / Non-Goals

**Goals:**

- Phone camera or library → preview → compressed upload → photo visible on the request, with no native app.
- Identical storage behavior in local development and production, with no divergent code path.
- Photos private by default, access derived from the parent request, and personal metadata removed.
- Upload failures do not lose the maintenance request.
- A small enough surface to ship and test as one change.

**Non-Goals:**

- Native shells (Capacitor/Expo), share targets, background upload, or an offline queue.
- Video, audio, documents, or arbitrary file types.
- Server-side image transformations beyond orientation, resize, and re-encode.
- Moderation, OCR, AI triage, or virus scanning.
- A public photo gallery or shareable links.

## Decisions

### 1. Two-phase direct upload to R2 with presigned PUT

Flow:

1. `POST /api/v1/maintenance-requests/{requestId}/attachments/intents` with `{ purpose, contentType, sizeBytes }` → returns `{ attachmentId, uploadUrl, headers, expiresAt }`.
2. Client `PUT`s the compressed JPEG to `uploadUrl` (same bytes, declared `Content-Type`).
3. `POST /api/v1/attachments/{attachmentId}/complete` → server verifies the object with `HeadObject`, normalizes it, marks it `READY` → returns the attachment summary.

The app server never relays image bytes during transfer; it only downloads the object once, at completion, to normalize it.

- **Why:** stays under serverless request-body limits (Vercel 4.5 MB), avoids app-server bandwidth, and gives real upload progress on mobile networks.
- **Alternatives:** proxying through a route handler is simpler but hits body limits and doubles bandwidth; presigned POST policies can enforce `content-length-range` at the bucket but add a second signing mechanism and a multipart form contract.

Limits: 5 photos per request (`ATTACHMENT_MAX_PER_REQUEST`), 15 MB accepted per file (`ATTACHMENT_MAX_BYTES`), 2000 px longest edge after client compression. The intent signs the exact `Content-Type`; `HeadObject` after completion rejects and deletes anything over the size limit. Presigned URLs expire in 10 minutes and are scoped to one key.

### 2. Private bucket, signed retrieval through the app

R2 bucket is private: no public domain, no anonymous read or list. UI renders `<img src="/api/v1/attachments/{id}">`; that route checks the caller's access to the parent request, then responds `302` to a signed GET URL with a 5-minute TTL and `Cache-Control: private, max-age=240`.

- **Why:** cookie-authenticated `<img>` works for both manager and tenant surfaces with no client fetching code; access stays server-side; signed URLs are short-lived.
- **Alternatives:** public bucket + unguessable keys leaks photos to anyone with a URL and breaks removal guarantees; serving bytes through the app costs bandwidth and loses CDN caching; JSON URL + fetch blob adds client complexity for no security gain.

Use a plain `<img>` with `loading="lazy"`, not `next/image`: the optimizer would re-fetch a private signed URL server-side and cache it outside the access check. Add `Referrer-Policy: same-origin` so signed URLs do not leak through outbound links.

Bucket CORS allows `PUT` from `APP_URL` with `Content-Type`, without credentials (the presigned URL carries its own signature).

### 3. Normalize on completion with `sharp`

At completion the server:

1. `HeadObject` — exists, `ContentLength ≤ limit`, `ContentType` in `image/jpeg|png|webp`.
2. Download, then decode with `sharp` using `limitInputPixels`, `rotate()` to bake orientation, resize to 2000 px max, strip metadata, re-encode JPEG q82.
3. `PutObject` the normalized bytes to the final key and update the row to `READY` atomically.

Reject and delete when the object does not decode as an image (magic-byte check, not the client-declared type). Completion is idempotent: a `READY` attachment returns its existing summary.

- **Why:** the client already re-encodes with canvas, so this is defense in depth; it also guarantees no GPS/EXIF survives even if a client skips compression.
- **Alternatives:** trust the client (a crafted upload can store arbitrary bytes); transform on read (repeats work and complicates caching).

HEIC is handled at the client: iOS Safari can decode HEIC in canvas and our pipeline always exports JPEG. Sharp's prebuilt binaries usually cannot decode HEIC, so a HEIC object reaching completion is rejected with a "re-export the photo" message rather than silently stored.

### 4. Data model

```prisma
enum AttachmentPurpose {
  REPORT_PHOTO
  RESOLUTION_PHOTO
}

enum AttachmentStatus {
  PENDING
  READY
}

model Attachment {
  id               String            @id @default(cuid())
  organizationId   String
  requestId        String
  uploadedByUserId String?
  purpose          AttachmentPurpose
  status           AttachmentStatus  @default(PENDING)
  storageKey       String            @unique
  mimeType         String
  sizeBytes        Int
  width            Int?
  height           Int?
  createdAt        DateTime          @default(now())
  completedAt      DateTime?

  organization Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  request      MaintenanceRequest  @relation(fields: [requestId], references: [id], onDelete: Cascade)
  uploadedBy   User?               @relation(fields: [uploadedByUserId], references: [id], onDelete: SetNull)

  @@index([organizationId, requestId, status])
  @@index([status, createdAt]) // cleanup sweep
}
```

- **Why:** explicit `requestId` FK keeps integrity and lets one visibility check govern list, retrieve, and delete. `PENDING` rows are what the cleanup sweep deletes. `organizationId` is denormalized so scoped queries and the cleanup job do not join through the request.
- **Alternatives:** polymorphic `subjectType/subjectId` is more flexible for future unit/property photos but has no referential integrity and complicates scoping; a separate `request_photos` table locks the model to one subject and would need migration later.
- **Key layout:** `org/{organizationId}/requests/{requestId}/{attachmentId}.jpg` — opaque ids only, no names or addresses.

### 5. Client capture and compression

A reusable client component owns the flow:

- `<input type="file" accept="image/*" capture="environment" multiple>` opens the rear camera on phones; omitting `capture` offers camera vs library.
- On selection: decode with `createImageBitmap(file, { imageOrientation: "from-image" })` (fallback to `<img>` + object URL in older Safari), resize so the longest edge is ≤ 2000 px, draw to canvas, export `image/jpeg` at 0.82.
- Show previews with `URL.createObjectURL`, revoke on remove/unmount.
- Upload sequentially (or concurrency 2) with `XMLHttpRequest` for `upload.onprogress`; `fetch` has no upload progress. Retry is per-photo.
- The compressed blob is the single source of truth for upload, retry, and preview.

- **Why:** 3–8 MB phone originals become 300–600 KB; HEIC becomes JPEG; EXIF location is dropped on the device; mobile Safari can struggle with many full-size decodes, so compress one at a time.
- **Alternatives:** `browser-image-compression` (same technique, extra dependency); uploading originals and compressing server-side (slower, more bandwidth, HEIC decode gap).

### 6. Submit request first, then upload photos

The tenant submits the request text through the existing server action; the request page then uploads selected photos against its id. Failed photos leave a visible retry state on the request detail. Server actions are not used for file bodies.

- **Why:** no draft/staging request state, no orphan requests, and a photo failure never costs the tenant their description. The photo intent requires a real `requestId`, which keeps authorization simple.
- **Alternatives:** upload to a staging prefix before submit and move on completion — better perceived latency but adds a second key lifecycle and "orphan before request" cleanup.
- **Edge:** new intents are refused once the request is cancelled/closed; an already-authorized upload may still complete. Existing photos stay readable.

### 7. Authorization reuse

A single `canViewRequest(principal, requestId)` / `canContributePhotos(...)` pair in the domain layer serves page loaders, the intent endpoint, retrieval, deletion, and completion. Managers see all requests in their organization; staff only assigned work orders; tenants only their own request. `scopedDb(orgId)` still supplies every query; endpoints resolve the session through the existing cookie and deny unauthenticated calls.

Endpoints accept the session cookie today. Because checks live in the shared domain layer, a future mobile client can add Bearer tokens without touching authorization logic.

### 8. Storage configuration and local development

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, optional `R2_ENDPOINT`; limits and TTLs as env with sane defaults. Local development runs MinIO in Docker with a pre-created private bucket, `.env` points `R2_ENDPOINT` at it, and the same S3 client and presigner are used.

- **Why:** one code path; S3-compatible API is what R2 exposes anyway; presigned PUT/CORS behavior can be tested locally.
- **Alternatives:** a filesystem storage adapter for dev is less setup but diverges in URL signing, CORS, and error handling — exactly the areas that break in production.

### 9. Cleanup

`POST /api/v1/internal/attachments/cleanup` (guarded by the existing `CRON_SECRET`) deletes `PENDING` attachments older than 24 hours: delete object (tolerate 404), then delete row. Scheduled daily. Sweep is idempotent and bounded per run.

- **Alternatives:** an R2 lifecycle rule cannot target only pending keys because pending and ready objects share the final prefix; a `staging/` prefix would allow a lifecycle rule but adds a copy step at completion.

### 10. UI surfaces

- Tenant request form: picker, previews, remove, global "uploading n of m" state.
- Tenant request detail: reporter and resolution photos, failed-photo banner with retry.
- Manager queue: photo-count badge.
- Manager/staff request and work-order detail: thumbnail grid with lightbox, "add resolution photo" for the assignee or a manager.
- All image tiles reserve aspect ratio to avoid layout shift and meet 44 px touch targets.

## Risks / Trade-offs

- **Presigned PUT cannot hard-cap bytes** → sign content type, check `ContentLength` on completion, delete oversize objects, keep URLs at 10 minutes; if abuse appears, move to presigned POST with `content-length-range`.
- **Serverless memory on decode** → `limitInputPixels`, 15 MB ceiling, and a 2000 px cap; process one photo per request.
- **HEIC cannot always be decoded server-side** → client always exports JPEG; reject anything else at completion with actionable copy.
- **Orphaned PENDING objects when cron fails** → idempotent sweep plus R2 usage alerting; pending rows are cheap and carry no user-visible state.
- **Signed URL leakage via referrer or logs** → 5-minute TTL, `Referrer-Policy: same-origin`, never log query strings from storage URLs.
- **Tenant photos contain homes and sometimes people** → private bucket, short URLs, delete support, and docs telling staff not to redistribute.
- **Rate abuse** → per-user intent rate limit, 5-photo cap, and 10-minute URL TTL bound storage growth.
- **Cost/CPU** → R2 has no egress fee and photos are small; normalization is the only CPU cost and is one-shot per photo.

## Migration Plan

1. Add bucket, credentials, CORS, and env vars; verify from a preview deployment before enabling the UI.
2. Ship the additive Prisma migration (`attachments`) and regenerate the client; no existing table changes.
3. Deploy endpoints and cleanup job; verify with direct API calls against a closed feature surface.
4. Enable the UI for tenants and managers. Because photos are optional, rollback is hiding the picker and pausing cleanup — existing attachments and objects remain readable.

## Open Questions

- Whether to generate a separate thumbnail object for queue lists. The first version serves one 2000 px JPEG and lets the browser scale; add thumbnails only if the queue becomes image-heavy.
- Record-retention period for photos after a request is closed or a tenancy ends. Deferred to a policy decision; the delete path already exists.
