FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_ENABLE_ADMIN=false
ARG VITE_API_BASE_URL=
ARG VITE_ENABLE_MEMBERSHIP=false
ARG VITE_ADSENSE_CLIENT=
ARG VITE_ADSENSE_SLOT_LEADERBOARD=
ARG VITE_ADSENSE_SLOT_INCONTENT=
ARG VITE_ADSENSE_SLOT_FOOTER=
ARG VITE_ANALYTICS_DOMAIN=
ARG VITE_AFFILIATE_ENABLED=false
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
