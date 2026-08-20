# ---------- BUILD ----------
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_APP_KEY


ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_KEY=$VITE_APP_KEY

RUN npm run build


# ---------- PRODUCTION ----------
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]