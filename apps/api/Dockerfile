FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# pnpm 10 is the major that wrote pnpm-lock.yaml (lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build
RUN pnpm exec tsc prisma/seed.ts --esModuleInterop --resolveJsonModule --outDir dist/prisma --skipLibCheck

FROM base AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
