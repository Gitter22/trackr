FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/web --include-workspace-root=false --ignore-scripts
# GraphQL codegen reads the API's SDL.
COPY apps/api/src/graphql/schema apps/api/src/graphql/schema
COPY apps/web apps/web
# Baked into the bundle so the app can tell marketing / admin / tenant hosts apart.
ARG APP_DOMAIN=localhost
ENV APP_DOMAIN=$APP_DOMAIN
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
