FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN npm install -g serve

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/dashboard/package.json packages/dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/dashboard/ packages/dashboard/
COPY tsconfig.base.json ./

# Build shared types first, then dashboard
RUN pnpm --filter @ivy/shared build && pnpm --filter @ivy/dashboard build

EXPOSE 3000
CMD sh -c "serve -s /app/packages/dashboard/dist -l tcp://0.0.0.0:$PORT"
