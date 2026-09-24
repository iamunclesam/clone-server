FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
COPY . .
RUN npm run build:packages

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 workeruser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

USER workeruser
CMD ["node", "packages/ai-runtime/dist/worker.js"]
