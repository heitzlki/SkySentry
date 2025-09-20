FROM oven/bun:latest

# Set the working directory
WORKDIR /app

# Copy project files into the container
COPY . .

# Install dependencies
RUN bun install

# Expose the app's port (change if your app uses a different one)
EXPOSE 6900

# Start the application
CMD ["bun", "run", "dev"]
