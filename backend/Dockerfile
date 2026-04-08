FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/

# Install dependencies
RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY backend ./backend
COPY tsconfig.base.json ./

# Build shared first, then backend
RUN npm run build -w @company-hub/shared
RUN npm run build -w @company-hub/backend

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src/db/migrations ./backend/dist/db/migrations
COPY backend/start.sh ./backend/

RUN chmod +x ./backend/start.sh
RUN mkdir -p /data/uploads

EXPOSE 3000

WORKDIR /app/backend
CMD ["./start.sh"]
