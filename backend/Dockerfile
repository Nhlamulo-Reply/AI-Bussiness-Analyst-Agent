FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV JSON_STORAGE_PATH=/data/ai-business-analyst.json

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev \
    && mkdir -p /data \
    && chown node:node /data
COPY --from=build --chown=node:node /app/dist/src ./dist/src

USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('node:http').get({hostname:'127.0.0.1', port:process.env.PORT || 3000, path:'/api/v1/health/ready'}, response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

CMD ["node", "dist/src/server.js"]
