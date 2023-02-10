# -----------------------------------------------------------------------------
# Codam Coding College, Amsterdam @ 2022.
# See README in the root project for more information.
# -----------------------------------------------------------------------------

FROM debian:buster

WORKDIR /app
RUN chmod a+rw ./

# The node version on the package deb is outdated as hell
# so we need to fetch the latest from nodesource
RUN apt update && apt -y install curl gnupg sqlite3
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt -y install nodejs

COPY package.json ./
COPY package-lock.json ./

# Setup the application itself
RUN npm install

COPY . ./

RUN npm run init-db
RUN npm run build

ENTRYPOINT [ "npm", "run", "start" ]

# For debugging.
# ENTRYPOINT ["tail", "-f", "/dev/null"]
