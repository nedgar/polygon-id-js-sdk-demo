# To build and test, use e.g.:
# - docker build -t polygon-id-js-sdk-demo --progress plain .
# - docker run -p 8080:8080 --env-file .env.docker polygon-id-js-sdk-demo
# where .env.docker has (without quotes):
# SESSION_SECRET=t0p-s3cr3t
# RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# base node image
FROM node:18-bullseye-slim as base

# set for base and all layers that inherit from it
ENV NODE_ENV production

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl sqlite3

# Install all node_modules, including dev dependencies
FROM base as deps

WORKDIR /myapp

COPY package.json package-lock.json .npmrc ./
RUN npm install --include=dev
RUN du -md 3 . | sort -nr | head -n 25

# Build the app
FROM deps as build

WORKDIR /myapp

ENV DATABASE_URL=file:/data/sqlite.db

COPY prisma prisma
COPY tsconfig.json .
RUN ls -al . && ls -al prisma
RUN npm run setup

COPY . .
RUN npm run build
RUN npm prune --omit=dev
RUN du -md 3 . | sort -nr | head -n 25

# Finally, build the production image with minimal footprint
FROM build

ENV DATABASE_URL=file:/data/sqlite.db
ENV PORT="8080"
ENV NODE_ENV="production"

# add shortcut for connecting to database CLI
RUN echo "#!/bin/sh\nset -x\nsqlite3 \$DATABASE_URL" > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

WORKDIR /myapp

ENTRYPOINT [ "npm", "run", "start" ]
