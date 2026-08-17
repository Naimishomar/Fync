FROM node:20-slim

# Production-only install, and let the runtime know it: NODE_ENV also switches off
# the dev request logging and turns on Express's production behaviour.
ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# The app listens on process.env.PORT, defaulting to 8000 — the old EXPOSE 3000
# advertised a port nothing was ever bound to.
ENV PORT=8000
EXPOSE 8000

# Don't run as root.
USER node

CMD ["node", "index.js"]
