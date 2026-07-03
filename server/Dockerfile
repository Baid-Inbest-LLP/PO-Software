FROM node:20-alpine

WORKDIR /app

# Chromium for PO PDF generation (Puppeteer)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
  && corepack enable && corepack prepare pnpm@latest --activate

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package.json ./
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY . .

RUN node scripts/generateEmbeddedAssets.js

EXPOSE 5003

CMD ["node", "server.js"]
