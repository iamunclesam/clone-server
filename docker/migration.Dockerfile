FROM node:20-alpine
WORKDIR /app
COPY packages/database ./packages/database
COPY package*.json ./
RUN npm ci
CMD ["npm", "--prefix", "packages/database", "run", "db:push"]
