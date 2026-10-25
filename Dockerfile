FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
