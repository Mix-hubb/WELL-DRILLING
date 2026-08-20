FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -p tsconfig.json

EXPOSE 4000

CMD ["node", "dist/server.js"]
