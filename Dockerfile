# ============================================
# Stage 1: Install dependencies
# ============================================

ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

# Install bun to use bun.lock for dependency resolution
RUN npm install -g bun

# Copy package-related files to leverage Docker cache
COPY package.json bun.lock* ./

# Install dependencies with frozen lockfile for reproducible builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --no-save --frozen-lockfile

# ============================================
# Stage 2: Build the Next.js application
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build-time env vars — override these with --build-arg or in compose.yml
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard/overview
ARG NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard/overview
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ORG
ARG NEXT_PUBLIC_SENTRY_PROJECT
ARG NEXT_PUBLIC_SENTRY_DISABLED=true

ENV BUILD_STANDALONE=true

RUN npm run build -- --webpack

# ============================================
# Stage 3: Production runner
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy public assets
COPY --from=builder --chown=node:node /app/public ./public

# Create .next dir with correct permissions for prerender cache
RUN mkdir .next && chown node:node .next

# Copy standalone output and static files
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
