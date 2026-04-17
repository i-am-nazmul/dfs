 # Distributed File System (DFS) with Fault Tolerance

This repository contains a multi-service distributed file storage system with:

- A master node for authentication, file metadata, chunk orchestration, and downloads
- Three worker nodes that store replicated file chunks on local disk
- A Next.js web UI that handles user login/signup and proxies requests to the master

The design goal is to keep files available when a worker goes down by replicating every chunk across multiple workers.

## Contents

1. Project Overview
2. High-Level Architecture
3. Repository Structure
4. Data Model (DynamoDB)
5. End-to-End Request Flows
6. APIs
7. Environment Variables
8. Local Setup and Run Guide
9. Operational Notes and Limitations
10. Troubleshooting
11. Future Improvements

## 1. Project Overview

### What this project does

- Users can sign up, log in, upload files, list files, inspect chunk placement, download files, and delete files.
- The master service splits uploads into fixed-size chunks (0.5 MB each).
- Each chunk is stored on 2 workers (replication factor = 2).
- Chunk metadata and file metadata are saved in DynamoDB.
- Download reconstructs the original file by reading chunks in order from any available replica.

### Why this architecture

- Reliability: if one worker is unavailable, replicas on other workers can still serve data.
- Separation of concerns:
  - Master: control plane + metadata
  - Workers: data plane (chunk storage)
  - UI: auth session and browser-facing APIs

## 2. High-Level Architecture

```
Browser
  |
  v
Next.js UI (user-interface)
  - validates cookies/JWT
  - rate limits some routes
  - proxies requests with x-api-key
  |
  v
Master API (master)
  - auth + metadata + chunk orchestration
  - stores metadata in DynamoDB
  |
  +--> Worker 1 (worker1) local disk chunks
  +--> Worker 2 (worker2) local disk chunks
  +--> Worker 3 (worker3) local disk chunks
```

### Replication policy

- `CHUNK_SIZE_BYTES = 512 * 1024` (0.5 MB)
- `REPLICATION_FACTOR = 2`
- For each chunk index, 2 workers are selected (round-robin style from reachable workers).

## 3. Repository Structure

- `master/`: Express master node
  - `controllers/authController.js`: signup/login logic
  - `controllers/fileController.js`: upload/list/chunk-info/download/delete
  - `middlewares/apiKeyMiddleware.js`: validates `x-api-key`
  - `middlewares/rateLimitMiddleware.js`: global API limiter for routed endpoints
  - `connectDB/dynamodb.js`: DynamoDB client
- `worker1/`, `worker2/`, `worker3/`: chunk storage workers (same implementation)
  - `index.js`: store/read/delete chunk files on disk
- `user-interface/`: Next.js frontend + API routes
  - `app/api/*`: server-side proxy routes to master
  - `app/dashboard/page.tsx`: upload/list/download/delete UI
  - `lib/jwt.ts`: signs and verifies `ui_token`
  - `lib/rateLimit.ts`: in-memory UI-side route limiting

## 4. Data Model (DynamoDB)

The implementation assumes these tables exist:

### `Users`

- Primary key: `email` (string)
- Attributes: `username`, `password` (bcrypt hash)

Notes:

- Signup checks duplicate username via `Scan`.
- Signup enforces unique email via conditional put (`attribute_not_exists(email)`).

### `Files`

- Primary key: `fileId` (string)
- Attributes:
  - `email`
  - `filename`
  - `storedFilename`
  - `fileSize` (number)
  - `fileType`
  - `totalChunks` (number)
  - `uploadDate`

Notes:

- User file listing is currently implemented via `Scan` filtered by `email`.

### `Chunks`

- Composite primary key:
  - Partition key: `fileId` (string)
  - Sort key: `chunkIndex` (number)
- Attributes:
  - `workers` (string set)
  - `chunkSize` (number)

Notes:

- Each row represents one chunk and all worker replicas storing it.

## 5. End-to-End Request Flows

### Signup/Login

1. Browser calls Next API route (`/api/signup` or `/api/login`).
2. Next route applies IP-based rate limit and forwards to master with `x-api-key`.
3. Master validates payload and credentials against DynamoDB.
4. Next route issues `ui_token` cookie (HTTP-only, 1 hour expiry).

### Upload

1. Browser uploads via `POST /api/upload` (multipart form-data).
2. Next route verifies `ui_token`, extracts email, applies upload rate limit, forwards file to master.
3. Master checks reachable workers (`GET /test`) and requires at least 2.
4. Master splits file into chunks and writes each chunk to 2 workers (`POST /chunks`).
5. Master writes `Chunks` rows and one `Files` row to DynamoDB.

### Download

1. Browser calls `GET /api/files/download` with file identifiers.
2. Next route verifies cookie and forwards request to master.
3. Master resolves file metadata and chunk map from DynamoDB.
4. Master fetches each chunk from available replicas until one succeeds.
5. Master concatenates chunks and streams attachment response.

### Delete

1. Browser calls `DELETE /api/files`.
2. Next route verifies cookie and forwards email + file identifier.
3. Master resolves file, requests workers to remove chunk directory (`DELETE /files/by-id`, best effort).
4. Master removes rows from `Chunks` and `Files`.

## 6. APIs

### Master API (`master`)

Base URL: `http://localhost:<MASTER_PORT>`

### Auth

- `POST /auth/signup`
  - Body: `{ "username", "email", "password" }`
- `POST /auth/login`
  - Body: `{ "username" or "email", "password" }`

### Files

- `POST /files/upload`
  - Multipart: `file`
  - Fields: `email`
- `GET /files/user-files?email=<email>`
- `GET /files/chunk-info?email=<email>&storedFilename=<name>` (or `filename`)
- `GET /files/download?email=<email>&storedFilename=<name>` (or `filename`)
- `DELETE /files/delete`
  - Body: `{ "email", "storedFilename" }` (or `filename`)

All routed endpoints use:

- API key middleware (`x-api-key` header)
- Express rate limiter (60 req/min per IP)

### Worker API (`worker1`, `worker2`, `worker3`)

Base URL: `http://localhost:<WORKER_PORT>`

- `GET /test` health endpoint
- `POST /chunks`
  - Body: `{ "email", "fileId", "chunkIndex", "chunkData" (base64) }`
- `GET /chunks/:fileId/:chunkIndex?email=<email>`
- `DELETE /files/by-id`
  - Body: `{ "email", "fileId" }`

### Next.js UI API (`user-interface/app/api`)

Browser-facing endpoints:

- `POST /api/signup`
- `POST /api/login`
- `POST /api/upload`
- `GET /api/files`
- `DELETE /api/files`
- `GET /api/files/chunk-info`
- `GET /api/files/download`

These routes:

- Verify `ui_token` for protected operations
- Enforce additional in-memory route rate limits on auth/upload
- Forward to master with `x-api-key`

## 7. Environment Variables

Create `.env` files per service.

### `master/.env`

```env
PORT=5000
API_KEY=replace_with_shared_secret
JWT_SECRET=replace_with_jwt_secret

# Optional worker URLs (defaults in code point to private LAN IPs)
WORKER1_BASE_URL=http://localhost:5001
WORKER2_BASE_URL=http://localhost:5002
WORKER3_BASE_URL=http://localhost:5003
```

### `user-interface/.env.local`

```env
MASTER_BASE_URL=http://localhost:5000
API_KEY=replace_with_same_shared_secret
JWT_SECRET=replace_with_same_jwt_secret
```

### `worker1/.env`

```env
PORT=5001
CHUNKS_DIR=./filechunks
```

### `worker2/.env`

```env
PORT=5002
CHUNKS_DIR=./filechunks
```

### `worker3/.env`

```env
PORT=5003
CHUNKS_DIR=./filechunks
```

Important:

- `API_KEY` in UI and master must match.
- `JWT_SECRET` in UI and master should be the same so tokens are consistently verifiable.
- Use distinct worker ports locally.

## 8. Local Setup and Run Guide

### Prerequisites

- Node.js 20+
- npm 10+
- AWS credentials and permissions for DynamoDB access
- DynamoDB tables: `Users`, `Files`, `Chunks`

### Install dependencies

Run in each service folder:

```bash
cd master && npm install
cd ../worker1 && npm install
cd ../worker2 && npm install
cd ../worker3 && npm install
cd ../user-interface && npm install
```

### Start services (recommended order)

1. Start workers:

```bash
cd worker1 && npm run dev
cd worker2 && npm run dev
cd worker3 && npm run dev
```

2. Start master:

```bash
cd master && npm run dev
```

3. Start frontend:

```bash
cd user-interface && npm run dev
```

Then open: `http://localhost:3000`

## 9. Operational Notes and Limitations

### Good behaviors currently implemented

- Upload blocked when fewer than 2 workers are reachable.
- Download falls back across chunk replicas.
- Chunk metadata completeness and replication checks before download.
- Best-effort worker cleanup on delete to avoid hard failures.

### Current trade-offs / limitations

- In-memory rate limiting in Next routes (`lib/rateLimit.ts`) is per-process and resets on restart.
- DynamoDB `Scan` is used for user/file lookups in some flows; this is simple but can be costly at scale.
- Worker endpoints currently do not enforce API key or token checks.
- Chunk uploads are performed sequentially per chunk/replica; throughput can be improved with controlled parallelism.
- No background repair process to rebuild missing replicas when a worker comes back.
- No automated tests are included yet.

## 10. Troubleshooting

### `503 At least 2 workers must be reachable`

- Ensure worker services are running.
- Verify `WORKER*_BASE_URL` values in `master/.env`.
- Check health endpoint manually: `GET <worker>/test`.

### Auth errors (`401 Invalid API key`)

- Confirm `API_KEY` matches between `master/.env` and `user-interface/.env.local`.
- Ensure Next routes are actually sending `x-api-key` (implemented in API proxy routes).

### JWT errors (`Invalid token` or unauthorized)

- Confirm `JWT_SECRET` is configured in both master and UI.
- Delete browser cookies and log in again.

### Upload/download failures

- Verify DynamoDB table names and key schema match expectations.
- Check master logs for chunk index failures.
- Check worker file system permissions for `CHUNKS_DIR`.

## 11. Future Improvements

- Add worker authentication (API key or mTLS).
- Add replication repair and rebalancing jobs.
- Add resumable uploads and parallel chunk transfer.
- Replace scans with indexed query patterns.
- Add integration tests for upload/download/delete and failure cases.
- Add observability (structured logs, metrics, traces).

---

If you want, I can also generate:

- Docker Compose for all 5 services
- A script to bootstrap DynamoDB tables
- API docs in OpenAPI format
