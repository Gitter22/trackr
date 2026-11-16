FROM node:24-alpine
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root --ignore-scripts
COPY prisma prisma
RUN npx prisma generate --schema prisma/control.prisma && npx prisma generate --schema prisma/tenant.prisma
COPY apps/api apps/api
RUN npm run build -w apps/api
ENV NODE_ENV=production
EXPOSE 4000
# Apply control-plane migrations, then start. Tenant DBs are migrated by provisioning / migrate:tenants.
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma/control.config.ts && node apps/api/dist/server.js"]
