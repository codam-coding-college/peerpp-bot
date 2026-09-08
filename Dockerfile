# -----------------------------------------------------------------------------
# Codam Coding College, Amsterdam @ 2022.
# See README in the root project for more information.
# -----------------------------------------------------------------------------

# Build stage: compile the TypeScript, then drop the devDependencies so they
# never reach the published image.
FROM node:26-trixie AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
	&& npm prune --omit=dev \
	&& npm cache clean --force

# -----------------------------------------------------------------------------

# Runtime stage: the compiled output and production dependencies only.
FROM node:26-trixie

WORKDIR /app

# The sqlite3 CLI is not part of the base image, but init-db needs it on startup.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends sqlite3 \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY sql ./sql
COPY config ./config
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

# init-db writes the database here and the app writes its log file; both are
# bind-mounted in production (see docker-compose.yml). Pre-create them owned by
# the unprivileged user so the container also works unmounted.
RUN mkdir -p ./db ./log && chown node:node ./db ./log

# Run unprivileged: a compromised process must not be able to rewrite its own
# code. The bind-mounted db/ and logs/ directories on the host must therefore be
# owned by uid 1000 -- see the Production section of the README.
USER node

ENTRYPOINT [ "npm", "run", "start" ]

# For debugging.
# ENTRYPOINT ["tail", "-f", "/dev/null"]
