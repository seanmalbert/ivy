FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/benefits-engine/package.json packages/benefits-engine/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/benefits-engine/ packages/benefits-engine/
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./

# Build
RUN pnpm --filter @ivy/shared build && pnpm --filter @ivy/benefits-engine build && pnpm --filter @ivy/server build

# Run
EXPOSE 3001
ENV PORT=3001
CMD ["node", "packages/server/dist/index.js"]
