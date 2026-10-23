# Use a lightweight Node.js image 
FROM node:24-alpine

# Set working directory
WORKDIR /src

# Set environment variables
ENV NODE_ENV="production"

# Copy package*.json and .env dependencies
COPY package*.json ./
COPY .env.template ./.env

# Install necessary system packages and dependencies
RUN npm ci --only=production --silent \
    && npm cache clean --force \
    && rm -rf /tmp/* /var/tmp/* /usr/share/doc/*

# Copy the application code, already owned by the runtime user
COPY --chown=node:node app app
COPY --chown=node:node public public

# Run as the non-root "node" user (uid/gid 1000) shipped with the base image
USER node

# Set default command to start the application
CMD ["npm", "start"]