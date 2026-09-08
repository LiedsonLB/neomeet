#!/bin/sh
set -e

DOMAIN=resenha.mooo.com
CERT_DIR=/etc/letsencrypt/live/$DOMAIN

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    echo "Certificado não encontrado, gerando self-signed temporário..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -days 1 \
        -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN"
fi

envsubst '${BACKEND_HOST} ${LIVEKIT_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g "daemon off;"