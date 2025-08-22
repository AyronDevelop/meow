FROM node:20-bookworm-slim AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
# Install poppler-utils for pdftocairo
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/lib ./lib
ENV NODE_ENV=production \
    PORT=8080
EXPOSE 8080
CMD ["node", "lib/index.js"]


