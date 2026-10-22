FROM node:20-alpine AS base
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund --fetch-retries=8 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --fetch-retries=8 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000
COPY . .
RUN ./node_modules/.bin/prisma generate

# Migration image: carries the Prisma CLI (a devDependency) plus the migration
# history. Deploys run this once, before any backend replica starts, so the
# replicas never race each other applying the same migration.
FROM build AS migrate
ENV NODE_ENV=production
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache postgresql-client
# node:20-alpine already ships a `node` user, so the runtime account is
# created under a different name to avoid colliding with it.
RUN addgroup -g 1001 -S app && adduser -S -G app -u 1001 app
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/package*.json ./
USER app
EXPOSE 4000
# Migrations are NOT run here: several replicas booting at once would race to
# apply them. Run the `migrate` stage/target as a release step instead.
CMD ["node", "src/server.js"]