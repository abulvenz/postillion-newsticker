FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY server.js ./
COPY data/tickers_cosearch.js ./data/

ENV DATA_FILE=./data/tickers_cosearch.js
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
