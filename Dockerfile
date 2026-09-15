# syntax=docker/dockerfile:1
# PKRTrackr — single container, SQLite on a mounted volume.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/pkrtrackr.db \
    NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app ./
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply pending migrations, then serve.
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -H 0.0.0.0 -p ${PORT}"]
