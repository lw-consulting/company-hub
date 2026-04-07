FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Install all dependencies
RUN npm install --workspace=@company-hub/shared --workspace=@company-hub/backend

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

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm install --workspace=@company-hub/shared --workspace=@company-hub/backend --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/src/db/migrations ./backend/src/db/migrations
COPY backend/start.sh ./backend/

RUN chmod +x ./backend/start.sh
RUN mkdir -p /data/uploads

EXPOSE 3000

WORKDIR /app/backend
CMD ["./start.sh"]
