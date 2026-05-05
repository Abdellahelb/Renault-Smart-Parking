FROM node:20-alpine

# Use /app as the working directory
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the codebase
COPY . .

# Expose the API port
EXPOSE 3001

# Set the node environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
