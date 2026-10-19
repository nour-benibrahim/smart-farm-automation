#!/bin/bash
# Railway deployment script for Smart Farm Backend

echo "Starting Smart Farm Backend..."
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm run start:prod
