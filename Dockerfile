FROM node:20-alpine

LABEL org.opencontainers.image.title="local-llm-chatbot" \
      org.opencontainers.image.source="https://github.com/Antak108/chatbot-app" \
      org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server.js db.js guardrails.js memory.js templates.js crypto.js auth.js blocklist.js redact.js audit.js metrics.js webhook.js plugins.js ./
COPY public/ public/
COPY data/ data/ 2>/dev/null || true
COPY plugins/ plugins/

EXPOSE 3000

USER node

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
