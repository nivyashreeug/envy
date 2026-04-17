# Envy Deployment Guide

## 1. Prepare environment files

- Copy `server/.env.production.example` to `server/.env` and fill real values.
- Copy `client/.env.production.example` to `client/.env` and set your API domain.

## 2. Validate locally

- Run server tests:
  - `npm --prefix server test`
- Build client:
  - `npm --prefix client run build`
- Run local smoke validation:
  - `npm run smoke:local`

## 3. Build and run with Docker Compose

- Build with production API URL:
  - `VITE_API_BASE_URL=https://your-api-domain.com docker compose up -d --build`
- Check health endpoint:
  - `http://localhost:5000/api/health`

## 4. Production checklist

- `AUTH_JWT_SECRET` is long/random and never committed.
- `CORS_ORIGINS` matches deployed frontend domain(s).
- `VITE_API_BASE_URL` matches deployed API origin.
- `MONGO_URI` points to production MongoDB.
- `REDIS_URL` is set for multi-instance rate limiting.
- HTTPS is enabled at the ingress/load balancer.
- CI smoke workflow is passing.
