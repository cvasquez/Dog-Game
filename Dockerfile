FROM node:20-slim

# better-sqlite3 requires native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .

ENV DB_PATH=/data/doggame.db
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "server/index.js"]
