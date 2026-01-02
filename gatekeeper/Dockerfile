# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY frontend ./frontend
WORKDIR /app/frontend
RUN npx vite build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build:backend

# Stage 3: Production
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
RUN npm ci --only=production

# Copy backend build
COPY --from=backend-builder /app/dist ./dist

# Copy frontend build  
COPY --from=frontend-builder /app/dist/public ./dist/public

USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
