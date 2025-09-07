FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY app/src src
COPY app/public public

EXPOSE 3000
CMD ["npm", "start"]
