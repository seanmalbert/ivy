FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ── Build stage ──
FROM base AS build
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/benefits-engine/package.json packages/benefits-engine/
COPY packages/server/package.json packages/server/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/benefits-engine/ packages/benefits-engine/
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./

# Build
RUN pnpm --filter @ivy/shared build && pnpm --filter @ivy/benefits-engine build && pnpm --filter @ivy/server build

# Prune devDependencies
RUN pnpm prune --prod

# ── Production stage ──
FROM base AS production
WORKDIR /app

# Copy only production node_modules and built output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/benefits-engine/package.json packages/benefits-engine/package.json
COPY --from=build /app/packages/benefits-engine/dist packages/benefits-engine/dist
COPY --from=build /app/packages/server/package.json packages/server/package.json
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/package.json ./package.json

ENV NODE_ENV=production
# PORT is set by Railway at runtime; defaults to 3001 in code
CMD ["node", "packages/server/dist/index.js"]
