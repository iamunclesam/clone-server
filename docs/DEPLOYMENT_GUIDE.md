# Clone AI OS — Production Deployment Guide

This guide details how to deploy Clone in production environments using Docker Compose, Kubernetes, or serverless infrastructure with MongoDB Atlas and Redis.

## 1. Environment Configuration

Copy `.env.example` to `.env.production` and populate mandatory secrets:

```bash
# Server & Security
NODE_ENV=production
PORT=4000
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
AES_256_KEY=64_character_hex_string_for_vault_encryption

# Database & Cache
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/clone_prod?retryWrites=true&w=majority
REDIS_URL=redis://:redis_password@redis.prod.internal:6379

# LLM Providers & AI Runtime
OPENAI_API_KEY=sk-prod-...
ANTHROPIC_API_KEY=sk-ant-prod-...
E2B_API_KEY=e2b_prod_key_...

# Third-Party Integrations
GITHUB_CLIENT_ID=gh_client_...
GITHUB_CLIENT_SECRET=gh_secret_...
SLACK_CLIENT_ID=slack_client_...
SLACK_CLIENT_SECRET=slack_secret_...
```

---

## 2. Docker Compose Deployment

Clone includes production-ready Dockerfiles and a `docker-compose.yml` file.

To launch the full production stack:

```bash
# Build and bring up backend API, web dashboard, MongoDB, and Redis
docker-compose up -d --build
```

### Stack Components:
- **`apps/api`**: Node.js Fastify API server running on port `4000`
- **`apps/web`**: Next.js App Router dashboard running on port `3000`
- **`mongodb`**: MongoDB 7.0 database cluster
- **`redis`**: Redis 7.2 in-memory rate limiter & cache

---

## 3. Production Health Checks & Monitoring

- **API Liveness Probe:** `GET /health` (Returns `{ status: "ok", timestamp: "..." }`)
- **API Readiness Probe:** `GET /ready` (Checks MongoDB & Redis connection states)
- **OpenAPI Schema Documentation:** `GET /documentation`
