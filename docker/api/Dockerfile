# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# ABI Desk API / worker image.
#
# One image serves both roles (PROCESS_ROLE=api|worker). Building them together
# guarantees the queue consumers and the HTTP handlers share identical domain
# code, which is the usual thing that rots when they are separate services.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# openssl: required by the Prisma query engine on musl.
# libc6-compat: needed by prebuilt native addons (@swc/core, sharp).
RUN apk add --no-cache openssl libc6-compat
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app


# --- Dependencies ----------------------------------------------------------
# Manifests are copied before sources so a source-only change does not
# invalidate the (slow) install layer.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
# Every workspace package the API resolves must have its manifest present, or
# `--frozen-lockfile` installs a graph that cannot link and the build fails late
# with an unresolvable import.
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/rbac/package.json ./packages/rbac/
COPY packages/widget/package.json ./packages/widget/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile


# --- Build -----------------------------------------------------------------
FROM deps AS build
COPY . .
# `prisma generate` runs inside Alpine so the musl query engine is the one that
# ends up in the image (see binaryTargets in schema.prisma).
RUN pnpm --filter @abi-desk/db run generate \
    && pnpm --filter @abi-desk/rbac run build \
    && pnpm --filter @abi-desk/widget run build \
    && pnpm --filter @abi-desk/db run build \
    && pnpm --filter @abi-desk/api run build


# --- Runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000

# `--chown` on COPY is dramatically cheaper than a `RUN chown -R` afterwards:
# the latter rewrites every file into a new layer, roughly doubling image size
# and adding ~a minute to the build.
COPY --from=build --chown=node:node /app /app
COPY --chmod=755 docker/api/entrypoint.sh /usr/local/bin/entrypoint.sh

# Never run application code as root.
USER node

EXPOSE 4000

# Busybox wget ships with Alpine, so no extra layer for a health probe.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/healthz || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
