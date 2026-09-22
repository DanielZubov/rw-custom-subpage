FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY public ./public

# Каталог для settings.json (создаётся автоматически при первом запуске,
# см. src/db.js). Монтируйте его как volume, чтобы не терять настройки
# из веб-админки при пересборке образа.
RUN mkdir -p /app/data

EXPOSE 3010

CMD ["node", "src/server.js"]
