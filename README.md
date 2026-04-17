# Envy

Production-ready MERN application for detecting hidden charges from uploaded bank statements (CSV/PDF) with a premium dark UI and privacy-first architecture.

## Stack

- Frontend: React + Vite + Tailwind CSS + Framer Motion + Recharts
- Backend: Node.js + Express + multer + MongoDB (optional aggregate persistence)
- Security: Helmet, rate limiting, CORS allow-list, compressed responses, no raw statement persistence

## Key Privacy Guarantees

- Statement files are processed in memory only.
- No PII fields (account number, address, personal identity details) are persisted.
- Only aggregate metrics are optionally saved when MongoDB is connected.

## Local Development

### 1) Configure environment

Copy example files and fill values:

- `server/.env.example` -> `server/.env`
- `client/.env.example` -> `client/.env`

Production templates are available at:

- `server/.env.production.example`
- `client/.env.production.example`

### 2) Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3) Run both apps

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:5000

## Tests

```bash
npm test
```

Run deployment smoke checks locally:

```bash
npm run smoke:local
```

## Production Build

```bash
npm run build
NODE_ENV=production npm --prefix server start
```

## Docker Deployment

### 1) Create server env file

Create `server/.env` with at least:

```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://mongo:27017/envy
CORS_ORIGINS=http://localhost:8080
RATE_LIMIT_MAX=120
AUTH_JWT_SECRET=replace-with-a-long-random-secret
AUTH_JWT_EXPIRES_IN=7d
REDIS_URL=redis://redis:6379
```

Create or export `VITE_API_BASE_URL` for client build-time API targeting:

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 2) Build and run

```bash
docker compose up -d --build
```

- Client: http://localhost:8080
- API: http://localhost:5000/api/health

## API Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/analyze` (`multipart/form-data` with `statement` field, requires Bearer token)

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strict `CORS_ORIGINS`
- [ ] Set `AUTH_JWT_SECRET` and keep it secret
- [ ] Provide a managed MongoDB URI (optional but recommended for aggregates)
- [ ] Set `VITE_API_BASE_URL` to your deployed API origin before building the client
- [ ] Configure Redis (`REDIS_URL`) for shared rate-limit state across instances
- [ ] Use HTTPS at the ingress/load balancer level
- [ ] Enable log aggregation and monitoring for API errors
- [ ] Run `npm test` in CI before deploy

Detailed rollout steps: see `DEPLOYMENT.md`
