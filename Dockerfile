FROM node:20-alpine

LABEL org.opencontainers.image.authors="Pranav Ashok <pranavashok@gmail.com>"

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

# Copy package files
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY --chown=node:node . .

# Build TypeScript code
RUN npm run build

EXPOSE 8080

# Use the serve script which runs the compiled JavaScript
CMD ["npm", "run", "serve"]
