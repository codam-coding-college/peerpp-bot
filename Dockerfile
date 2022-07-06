FROM node:18-slim

WORKDIR /app
# RUN chown -R node:node /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build


EXPOSE 8080
EXPOSE 3000

USER node
ENTRYPOINT [ "npm", "run", "start" ]
