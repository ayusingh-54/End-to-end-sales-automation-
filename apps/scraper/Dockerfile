FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/scraper/package.json apps/scraper/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/scraper apps/scraper
RUN pnpm -F @lwl/scraper build

FROM mcr.microsoft.com/playwright:v1.49.1-jammy AS runtime
ENV NODE_ENV=production PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/.npmrc ./
COPY --from=build /repo/apps/scraper/package.json apps/scraper/
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/scraper/dist apps/scraper/dist
RUN pnpm install --frozen-lockfile --prod
USER pwuser
CMD ["node", "apps/scraper/dist/index.js"]
