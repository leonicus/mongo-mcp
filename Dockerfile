FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies without triggering prepare/build
RUN npm install --ignore-scripts

# Now copy the full codebase (tsconfig.json, src/, etc.)
COPY . .

# Manually build after source files are in place
RUN npm run build
