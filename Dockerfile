# -----------------------------------------------------------------------------
# Codam Coding College, Amsterdam @ 2022.
# See README in the root project for more information.
# -----------------------------------------------------------------------------

FROM node:26-trixie

WORKDIR /app
RUN chmod a+rw ./

# The sqlite3 CLI is not part of the base image, but init-db needs it on startup.
RUN apt update && apt -y install sqlite3

COPY package.json ./
COPY package-lock.json ./

# Setup the application itself
RUN npm install

COPY . ./

RUN npm run build

ENTRYPOINT [ "npm", "run", "start" ]

# For debugging.
# ENTRYPOINT ["tail", "-f", "/dev/null"]
