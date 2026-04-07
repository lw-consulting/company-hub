FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Install dependencies (no lock file yet, using npm install)
RUN npm install

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
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/backend/dist ./backend/dist
RUN mkdir -p ./backend/dist/db/migrations
COPY backend/start.sh ./backend/

RUN chmod +x ./backend/start.sh
RUN mkdir -p /data/uploads

EXPOSE 3000

WORKDIR /app/backend
CMD ["./start.sh"]
