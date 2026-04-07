FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/

# Install all dependencies
RUN npm install --workspace=@company-hub/shared --workspace=@company-hub/frontend

# Copy source
COPY packages/shared ./packages/shared
COPY frontend ./frontend
COPY tsconfig.base.json ./

# Build shared first, then frontend
RUN npm run build -w @company-hub/shared
RUN npm run build -w @company-hub/frontend

# Nginx stage
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
