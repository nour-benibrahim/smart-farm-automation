#!/bin/bash

# 🆓 FREE Smart Farm IoT Stack Deployment to Railway
# This script helps you deploy your Smart Farm to Railway for FREE testing

set -e

echo "🆓 Deploying Smart Farm IoT Stack to Railway (FREE)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if code is pushed to GitHub
check_github() {
    print_status "Checking if code is pushed to GitHub..."
    
    if ! git remote get-url origin &> /dev/null; then
        print_error "No GitHub remote found. Please add your GitHub repository:"
        print_status "git remote add origin https://github.com/yourusername/smart-farm-backend.git"
        exit 1
    fi
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes. Committing them..."
        git add .
        git commit -m "Railway deployment ready"
    fi
    
    # Check if code is pushed
    if ! git diff --quiet origin/main; then
        print_status "Pushing code to GitHub..."
        git push origin main
    fi
    
    print_success "Code is ready on GitHub"
}

# Deploy backend to Railway
deploy_backend() {
    print_status "Deploying backend to Railway..."
    
    print_status "Please follow these steps:"
    echo ""
    echo "1. 🌐 Go to: https://railway.app"
    echo "2. 🔐 Sign up with GitHub"
    echo "3. ➕ Click 'New Project'"
    echo "4. 📁 Select 'Deploy from GitHub repo'"
    echo "5. 🎯 Choose your 'smart-farm-backend' repository"
    echo "6. 🗄️  Add PostgreSQL database:"
    echo "   - Click 'New' → 'Database' → 'PostgreSQL'"
    echo "7. ⚙️  Add environment variables:"
    echo "   - NODE_ENV = production"
    echo "   - JWT_SECRET = $(openssl rand -base64 32)"
    echo "   - MQTT_BROKER_URL = mqtt://broker.hivemq.com:1883"
    echo "8. 🚀 Click 'Deploy'"
    echo ""
    
    read -p "Press Enter when backend is deployed..."
    
    print_success "Backend deployment completed"
}

# Deploy frontend to Railway
deploy_frontend() {
    print_status "Deploying frontend to Railway..."
    
    print_status "Please follow these steps:"
    echo ""
    echo "1. 🌐 Go to: https://railway.app"
    echo "2. ➕ Click 'New Project'"
    echo "3. 📁 Select 'Deploy from GitHub repo'"
    echo "4. 🎯 Choose your 'smart-farm-frontend' repository"
    echo "5. ⚙️  Add environment variables:"
    echo "   - API_URL = https://your-backend-url.railway.app"
    echo "   - WS_URL = wss://your-backend-url.railway.app"
    echo "6. 🚀 Click 'Deploy'"
    echo ""
    
    read -p "Press Enter when frontend is deployed..."
    
    print_success "Frontend deployment completed"
}

# Setup MQTT broker
setup_mqtt() {
    print_status "Setting up MQTT broker..."
    
    print_success "Using free HiveMQ broker:"
    echo "📡 MQTT URL: mqtt://broker.hivemq.com:1883"
    echo "🌐 WebSocket: ws://broker.hivemq.com:8000"
    echo "📊 Dashboard: https://www.hivemq.com/public-mqtt-broker/"
    echo ""
    echo "🔧 Update your IoT devices to connect to:"
    echo "   mqtt://broker.hivemq.com:1883"
    echo ""
}

# Show deployment info
show_info() {
    print_success "🎉 Smart Farm IoT Stack deployed to Railway!"
    echo ""
    echo "📋 Your FREE Smart Farm is now live:"
    echo "===================================="
    echo ""
    echo "🌐 Frontend: https://your-frontend-url.railway.app"
    echo "🔧 Backend: https://your-backend-url.railway.app"
    echo "📡 MQTT: mqtt://broker.hivemq.com:1883"
    echo ""
    echo "💰 Cost: FREE (with $5/month Railway credits)"
    echo ""
    echo "📱 Next Steps:"
    echo "1. Test your app at the frontend URL"
    echo "2. Configure IoT devices to connect to HiveMQ"
    echo "3. Monitor your app in Railway dashboard"
    echo "4. Set up custom domain (optional)"
    echo ""
    echo "🔧 Railway Dashboard: https://railway.app/dashboard"
    echo "📊 HiveMQ Dashboard: https://www.hivemq.com/public-mqtt-broker/"
    echo ""
    print_success "🚀 Your Smart Farm is ready for testing!"
}

# Main deployment
main() {
    print_status "Starting FREE Smart Farm deployment to Railway..."
    
    check_github
    deploy_backend
    deploy_frontend
    setup_mqtt
    show_info
    
    print_success "🆓 FREE deployment completed!"
}

# Run deployment
main "$@"
