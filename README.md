# Slides Add-on Backend (Firebase + Cloud Run)

Backend for a Google Slides Editor Add-on. It accepts PDF uploads, renders page images, and uses OpenAI (gpt-4o-mini) to produce a slide deck JSON. The result is consumable by the Add-on to create slides in Google Slides.

## Overview

- API: Firebase Cloud Functions (HTTP) + Pub/Sub worker
- Renderer: Cloud Run service rendering PDF pages to PNG via `pdftocairo`
- Storage: Google Cloud Storage (uploads/jobs)
- State: Firestore (jobs, anti-replay nonces)
- Orchestration: Pub/Sub (job queue)
- LLM: OpenAI `gpt-4o-mini` with strict JSON schema output
- Security: HMAC-SHA256 auth, anti-replay nonce, signed URLs (V4)

OpenAPI spec: `docs/openapi.yaml`

## Architecture

- `api` (HTTP, Functions):
  - `POST /v1/uploads/signed-url` – returns a V4 signed URL for direct PDF upload to GCS.
  - `POST /v1/jobs` – creates a job, publishes to Pub/Sub.
  - `GET /v1/jobs/{jobId}` – polls status; when done, returns signed URL to `result.json`.
- `jobsWorker` (Pub/Sub, Functions):
  - Downloads PDF, extracts text, calls the Cloud Run `renderer` (optional) to get page images, invokes OpenAI to generate a Slides JSON, writes `result.json` to the jobs bucket.
- `renderer` (Cloud Run):
  - `POST /render` – downloads the PDF from GCS, renders pages to PNG via `pdftocairo`, uploads to jobs bucket under `jobs/{jobId}/pages/{n}.png`.

Buckets (default naming – can be overridden by env):
- Uploads: `{PROJECT_ID}-slides-uploads`
- Jobs: `{PROJECT_ID}-slides-jobs`

## Security

- HMAC-SHA256 authentication for non-public endpoints:
  - Headers: `X-Timestamp` (ms), `X-Nonce` (UUID), `X-Signature` (base64), optional `X-Key-Id` (key rotation)
  - Canonical string: `METHOD\nPATH\nX-Timestamp\nBODY\nX-Nonce`
- Anti-replay nonce stored in Firestore with TTL to prevent reuse within a time window.
- Per-request `X-Request-Id` and structured logs.
- GCS V4 Signed URLs for uploads and result access.

## Deployment

Prerequisites:
- gcloud CLI, Firebase CLI, Node.js 20, a GCP project
- Project ID: set `PROJECT_ID=<your_project>`

1) Enable APIs
```bash
PROJECT_ID=<your_project>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com pubsub.googleapis.com firestore.googleapis.com secretmanager.googleapis.com --project "$PROJECT_ID"
```

2) Create or verify GCS buckets (optional if created automatically by usage)
```bash
# If needed; replace with your preferred locations
gsutil mb -p "$PROJECT_ID" -l US gs://$PROJECT_ID-slides-uploads || true
gsutil mb -p "$PROJECT_ID" -l US gs://$PROJECT_ID-slides-jobs || true
```

3) Deploy Cloud Run renderer
```bash
# From repo root or renderer dir
gcloud run deploy slides-renderer \
  --source backend/renderer \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --project "$PROJECT_ID"
# Note the service URL, e.g.: https://slides-renderer-XXXXXXXXX.us-central1.run.app
```

4) Grant Cloud Run invoker to Functions service account
```bash
SA="$PROJECT_ID@appspot.gserviceaccount.com"
gcloud run services add-iam-policy-binding slides-renderer \
  --region us-central1 \
  --member serviceAccount:$SA \
  --role roles/run.invoker \
  --project "$PROJECT_ID"
```

5) Configure Functions
- Secrets (required):
```bash
firebase functions:secrets:set ADDON_SHARED_SECRET --project "$PROJECT_ID"
firebase functions:secrets:set OPENAI_API_KEY --project "$PROJECT_ID"
```
- Runtime config (renderer URL):
```bash
firebase functions:config:set renderer.url="https://slides-renderer-XXXXXXXXX.us-central1.run.app" --project "$PROJECT_ID"
```

6) Deploy Functions
```bash
# From repo root
firebase deploy --only functions --project "$PROJECT_ID"
# API URL example: https://us-central1-<PROJECT_ID>.cloudfunctions.net/api
```

## Local Development

- Emulators (Functions, Firestore, Pub/Sub):
  - Ensure a local service account JSON is set if you need V4 signed URLs locally: `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json`
```bash
# From repo root
ADDON_SHARED_SECRET=test \
OPENAI_API_KEY=dummy \
OPENAI_DISABLED=true \
REGION=us-central1 \
FIREBASE_PROJECT_ID=$PROJECT_ID \
GCS_BUCKET_UPLOADS=$PROJECT_ID-slides-uploads \
GCS_BUCKET_JOBS=$PROJECT_ID-slides-jobs \
firebase emulators:start --only functions,firestore,pubsub --project "$PROJECT_ID"
```

- Smoke test (local or prod):
```bash
# Prod
BASE_URL=https://us-central1-$PROJECT_ID.cloudfunctions.net/api \
ADDON_SECRET=<shared_secret> \
node scripts/smoke.mjs
```

## Usage (API)

- OpenAPI: see `docs/openapi.yaml` for request/response schemas
- HMAC signing: build `METHOD\nPATH\nTIMESTAMP\nBODY\nNONCE`, compute `HMAC-SHA256(secret)` over it, base64-encode to `X-Signature`
- Endpoints: `/public/health`, `/v1/uploads/signed-url`, `/v1/jobs`, `/v1/jobs/{jobId}`

## Principles of Operation

1) Client requests signed URL for a PDF upload
2) Client uploads PDF directly to GCS via the signed URL
3) Client creates a job referencing `uploadId`
4) Worker receives job (Pub/Sub), downloads the PDF, extracts text
5) Worker optionally calls Cloud Run renderer to render page PNGs and generates signed URLs to those images
6) Worker calls OpenAI (`gpt-4o-mini`) with text + optional image URLs and obtains a strictly validated `SlidesResult` JSON
7) Worker writes `result.json` to the jobs bucket and marks job as `done`
8) Client polls job status and, once ready, downloads `result.json` via a signed URL

Notes:
- Images in the result are guided by the prompt but ultimately model-driven; URLs are signed and expire (~2h). Re-generate as needed.
- Limits are enforced for PDF size and page count.

## Configuration

Environment variables recognized by Functions:
- `REGION` (default: `us-central1`)
- `FIREBASE_PROJECT_ID` or `GCLOUD_PROJECT`
- `GCS_BUCKET_UPLOADS` (default: `${PROJECT}-slides-uploads`)
- `GCS_BUCKET_JOBS` (default: `${PROJECT}-slides-jobs`)
- `PDF_MAX_BYTES` (default: `31457280`)
- `PDF_MAX_PAGES` (default: `150`)
- `SIGNED_URL_TTL_SECONDS` (default: `7200`)
- `OPENAI_DISABLED` (`true|false`, default `false`) – stub LLM
- `DEBUG_LLM` (`true|false`) – extra LLM logs
- `RENDERER_URL` (alternatively set via `functions.config().renderer.url`)

Secrets:
- `ADDON_SHARED_SECRET` – HMAC secret
- `OPENAI_API_KEY` – OpenAI key for `gpt-4o-mini`

## Observability

- Structured logging with request correlation (`X-Request-Id`)
- Error handling via consistent JSON errors
- Recommend Cloud Monitoring alerts on error rates, Pub/Sub backlog, Cloud Run errors

## Testing

- Unit/Integration (Functions): `cd backend/functions && npm test`
- Smoke (E2E): `node scripts/smoke.mjs`

## Limits & Quotas

- PDF size limit and page limit (configurable)
- Signed URL TTL (~2h by default)
- OpenAI token limits/costs – consider batching and summarization for large documents

## Troubleshooting

- `Cannot sign data without client_email` – set `GOOGLE_APPLICATION_CREDENTIALS` to a SA JSON locally
- Firestore/PubSub disabled – enable APIs and create Firestore DB (Native mode)
- Permissions – ensure Functions SA has `roles/storage.objectAdmin` on buckets; renderer has `roles/run.invoker`
- Nonce required – use `/public/health` for public checks; include HMAC headers otherwise
- Ports taken in emulator – adjust ports in `firebase.json`

## Roadmap / Future Work

- Migrate from `functions.config()` to dotenv-based configs (pre-2026)
- Renderer unit tests; OpenAPI UI/HTML generation
- Firestore TTL indexes and GCS lifecycle policies
- CI/CD pipelines with tests and lint gates
