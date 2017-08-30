FROM ryanj/centos7-s2i-nodejs:4

# Copy application code.
COPY package.json .

# Install dependencies.
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index"]
