FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY app/src src
COPY app/public public

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
