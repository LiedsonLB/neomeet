# ---------- PRODUCTION ----------
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV BACKEND_HOST=api
ENV LIVEKIT_HOST=livekit

ENTRYPOINT ["/docker-entrypoint.sh"]