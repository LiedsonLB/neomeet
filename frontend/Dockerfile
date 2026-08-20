# ---------- BUILD ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_APP_KEY
ARG VITE_GOOGLE_CLIENT_ID

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_KEY=$VITE_APP_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build


# ---------- PRODUCTION ----------
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html

# nginx.conf usa variáveis ${BACKEND_HOST} etc — envsubst as substitui em runtime
COPY nginx.conf /etc/nginx/nginx.conf.template

# BACKEND_HOST padrão aponta para o serviço "api" da rede do compose
ENV BACKEND_HOST=api

CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]