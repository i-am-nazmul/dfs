# Distributed File System (DFS) with Fault Tolerance

This repository contains a 5-service distributed file storage system:

- 1 master service (metadata, auth, chunk orchestration)
- 3 worker services (chunk storage on local disk)
- 1 Next.js web app (UI + API proxy + cookie-based auth session)

Each file is split into 0.5 MB chunks and replicated to 2 workers. The design target is availability during single-worker failure.

## What Is Implemented

- User signup/login
- Upload, list, download, and delete files
- Chunk-level replication metadata visibility in dashboard
- Upload guard: requires at least 2 reachable workers
- Download fallback across chunk replicas
- API-key validation between UI proxy and master
- Basic rate limiting on master routes and selected UI routes

## Architecture

```
Browser
  |
  v
Next.js app (user-interface)
  - issues/verifies ui_token cookie
  - proxies browser requests to master
  - passes x-api-key header
  |
  v
Master API (master)
  - auth + metadata + chunk orchestration
  - DynamoDB metadata tables
  |
  +--> Worker 1 (worker1) local chunk files
  +--> Worker 2 (worker2) local chunk files
  +--> Worker 3 (worker3) local chunk files
```

### Replication Policy

- Chunk size: `512 * 1024` bytes (0.5 MB)
- Replication factor: `2`
- Worker selection: deterministic round-robin over currently reachable workers

## Repository Structure

- `master/`
  - `index.js`: Express bootstrap + request logging + routes
  - `controllers/authController.js`: signup/login against DynamoDB
  - `controllers/fileController.js`: upload/list/chunk-info/download/delete
  - `middlewares/apiKeyMiddleware.js`: enforces `x-api-key`
  - `middlewares/rateLimitMiddleware.js`: route limiter (`60 req/min/IP`)
  - `connectDB/dynamodb.js`: DynamoDB client (`region: ap-south-1`)
- `worker1/`, `worker2/`, `worker3/`
  - `index.js`: worker API to store/read/delete chunk files
- `user-interface/`
  - `app/api/*`: authenticated proxy routes from browser to master
  - `app/dashboard/page.tsx`: upload/list/download/delete/chunk-inspect UI
  - `components/Loader.tsx`, `components/ErrorAlert.tsx`: overlay UX
  - `lib/jwt.ts`: signs/verifies `ui_token`
  - `lib/rateLimit.ts`: in-memory limiter for selected routes

## DynamoDB Data Model

The code expects the following tables.

### `Users`

- Partition key: `email` (String)
- Attributes used: `username`, `password` (bcrypt hash)

### `Files`

- Partition key: `fileId` (String)
- Attributes used: `email`, `filename`, `storedFilename`, `fileSize`, `fileType`, `totalChunks`, `uploadDate`

### `Chunks`

- Partition key: `fileId` (String)
- Sort key: `chunkIndex` (Number)
- Attributes used: `workers` (String Set), `chunkSize` (Number)

## API Summary

### Master API

Base: `http://localhost:5000` (or `PORT` override)

- `POST /auth/signup`
- `POST /auth/login`
- `POST /files/upload` (multipart `file`, plus `email`)
- `GET /files/user-files?email=...`
- `GET /files/chunk-info?email=...&storedFilename=...` (or `filename`)
- `GET /files/download?email=...&storedFilename=...` (or `filename`)
- `DELETE /files/delete` with JSON body `{ email, storedFilename? , filename? }`

All these routes currently apply both:

- API key middleware
- express-rate-limit middleware (`60/min/IP`)

### Worker API

Each worker exposes:

- `GET /test`
- `POST /chunks`
- `GET /chunks/:fileId/:chunkIndex?email=...`
- `DELETE /files/by-id`

### Next.js Browser-Facing API

- `POST /api/signup`
- `POST /api/login`
- `POST /api/upload`
- `GET /api/files`
- `DELETE /api/files`
- `GET /api/files/chunk-info`
- `GET /api/files/download`

Protected routes verify the `ui_token` cookie and forward requests to master with `x-api-key`.

## Environment Variables

### 1) Master (`master/.env`)

```env
PORT=5000
API_KEY=replace_with_shared_secret
JWT_SECRET=replace_with_master_secret

```

### 2) UI (`user-interface/.env.local`)

```env
MASTER_BASE_URL=http://localhost:5000
API_KEY=replace_with_same_shared_secret
JWT_SECRET=replace_with_ui_secret
```

### 3) Workers

Workers read `PORT` and `CHUNKS_DIR` from process environment, but worker code does not load `.env` files automatically. Set env vars in your shell or process manager when starting workers.

Examples used in this README:

- Worker1: `PORT=5000`, `CHUNKS_DIR=./filechunks`
- Worker2: `PORT=5000`, `CHUNKS_DIR=./filechunks`
- Worker3: `PORT=5000`, `CHUNKS_DIR=./filechunks`

## Local Run Guide

### Prerequisites

- Node.js 20+
- npm 10+
- AWS credentials with DynamoDB read/write permissions
- DynamoDB tables: `Users`, `Files`, `Chunks`

### Install Dependencies

From repo root:

```bash
cd master && npm install
cd ../worker1 && npm install
cd ../worker2 && npm install
cd ../worker3 && npm install
cd ../user-interface && npm install
```

### Start Services

Use 5 terminals.

### Terminal 1: worker1

PowerShell:

```powershell
cd worker1
$env:PORT="5000"
$env:CHUNKS_DIR="./filechunks"
node index.js
```

Bash:

```bash
cd worker1
PORT=5000 CHUNKS_DIR=./filechunks node index.js
```

### Terminal 2: worker2

PowerShell:

```powershell
cd worker2
$env:PORT="5000"
$env:CHUNKS_DIR="./filechunks"
node index.js
```

Bash:

```bash
cd worker2
PORT=5000 CHUNKS_DIR=./filechunks node index.js
```

### Terminal 3: worker3

PowerShell:

```powershell
cd worker3
$env:PORT="5000"
$env:CHUNKS_DIR="./filechunks"
node index.js
```

Bash:

```bash
cd worker3
PORT=5000 CHUNKS_DIR=./filechunks node index.js
```

### Terminal 4: master

```bash
cd master
node index.js
```

### Terminal 5: UI

```bash
cd user-interface
npm run dev
```

Open: `http://localhost:3000`

## Runtime Notes

- Upload fails with HTTP 503 if fewer than 2 workers are reachable.
- Worker storage cleanup on delete is best-effort; metadata deletion still proceeds.
- Dashboard currently shows errors with an overlay card.
- Login/Signup pages currently show a generic "Server is sleeping" message on request errors.

## Known Limitations

- Worker APIs are not authenticated.
- Next.js rate limiter is in-memory and per-process (`user-interface/lib/rateLimit.ts`).
- Master uses DynamoDB scans for some lookups (`Users` by username, `Files` by email/filename).
- No resumable uploads or background replica-repair job.
- No automated tests in repository.
- Logout is currently client navigation only (no server endpoint clearing cookie).
- DynamoDB region is hardcoded to `ap-south-1` in `master/connectDB/dynamodb.js`.

## Troubleshooting

### `At least 2 workers must be reachable for upload.`

- Confirm all 3 workers are running.
- Confirm master env has correct `WORKER*_BASE_URL` values.
- Check each worker health route: `GET http://localhost:5000/test` etc.

### `Invalid API key.`

- Ensure `API_KEY` matches between master and UI env.

### `Unauthorized` or `Invalid token`

- Ensure UI has `JWT_SECRET` configured.
- Clear browser cookies and log in again.

### Ports already in use

- All workers default to port 5000 if `PORT` is not set.


## Suggested Next Improvements

- Add worker auth (API key or mTLS).
- Add proper logout endpoint to clear `ui_token`.
- Add DynamoDB GSIs and replace scans with query patterns where possible.
- Add integration tests for upload/download/delete and worker-failure cases.
- Add Docker Compose for one-command local startup.
