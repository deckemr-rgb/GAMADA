# GAMADA AI proxy: Node 22 alpine, multi-stage, runs as the non-root `node` user.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY prompts ./prompts
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0
WORKDIR /app
# code stays root-owned (read-only for the app user)
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/ai/health >/dev/null || exit 1
CMD ["node", "dist/src/node.js"]
