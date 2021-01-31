FROM node:15.7-alpine

MAINTAINER Pranav Ashok <pranavashok@gmail.com>

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

# Copy application code.
COPY --chown=node:node package*.json ./

# Install dependencies.
RUN npm install

COPY --chown=node:node . .

EXPOSE 8080

CMD ["node", "index.js"]
