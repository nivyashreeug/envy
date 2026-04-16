# Invisible Fee Tracker

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
MONGO_URI=mongodb://mongo:27017/invisible_fee_tracker
CORS_ORIGINS=http://localhost:8080
RATE_LIMIT_MAX=120
```

### 2) Build and run

```bash
docker compose up -d --build
```

- Client: http://localhost:8080
- API: http://localhost:5000/api/health

## API Endpoints

- `GET /api/health`
- `POST /api/analyze` (`multipart/form-data` with `statement` field)

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set strict `CORS_ORIGINS`
- [ ] Provide a managed MongoDB URI (optional but recommended for aggregates)
- [ ] Use HTTPS at the ingress/load balancer level
- [ ] Enable log aggregation and monitoring for API errors
- [ ] Run `npm test` in CI before deploy
