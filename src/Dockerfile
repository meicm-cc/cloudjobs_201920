
FROM node

RUN mkdir -p /var/app

WORKDIR /var/app

COPY ./ ./

RUN npm install

EXPOSE 10000

CMD ["node", "backend/index.js" ]