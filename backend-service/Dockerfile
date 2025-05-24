# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install --only=production

# Copy the rest of the application code into the container
COPY . .

# Make your application's port accessible
EXPOSE 1111

# Define the command to run your app
CMD [ "node", "server.min.js" ]