FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --fund=false

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Development target
FROM node:20-slim AS dev
WORKDIR /app
ENV NODE_ENV=development HOST=0.0.0.0 PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]

# Production runtime
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# Copy only what's needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./package.json
EXPOSE 3000
CMD ["npx","next","start","-p","3000","-H","0.0.0.0"]
