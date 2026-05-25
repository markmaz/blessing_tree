FROM node:22-slim AS build

WORKDIR /app

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY blessing-tree-ui/package.json blessing-tree-ui/package-lock.json ./
RUN npm ci

COPY blessing-tree-ui/index.html blessing-tree-ui/tsconfig*.json blessing-tree-ui/vite.config.ts ./
COPY blessing-tree-ui/public ./public
COPY blessing-tree-ui/src ./src

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/docker/nginx/blessing-tree-ui.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
