# Smart Deal storefront — TanStack Start SSR, built with Nitro's node-server
# preset so it runs as a plain Node process (the repo default targets Cloudflare).
FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
# node:24 ships npm 11, matching the lockfile. npm 10 (node:20) wrongly demands
# optional peer deps (unstorage -> lru-cache) be present and fails `npm ci`.
RUN npm ci

COPY . .

# VITE_* values are inlined into the browser bundle at build time, so this must
# be the public URL the visitor's browser will call — not a container hostname.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN NITRO_PRESET=node-server npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
