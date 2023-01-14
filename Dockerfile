# -----------------------------------------------------------------------------
# Codam Coding College, Amsterdam @ 2022.
# See README in the root project for more information.
# -----------------------------------------------------------------------------

FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

COPY . ./

RUN npm run init-db
RUN npm run build

ENTRYPOINT [ "npm", "run", "start" ]

# For debugging.
# ENTRYPOINT ["tail", "-f", "/dev/null"]
