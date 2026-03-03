# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN bunx prisma generate
RUN bun run build

# Production stage
FROM oven/bun:1-alpine AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma/ ./prisma/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["bun", "dist/index.js"]

# Development stage
FROM oven/bun:1-alpine AS development
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bunx prisma generate
EXPOSE 3000
CMD ["bun", "run", "dev"]
