# Complete IoT Stack Deployment Script
#!/bin/bash

echo "🚀 Deploying Smart Farm IoT Stack..."

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run as root. Use a regular user with sudo access."
    exit 1
fi

# Create application directory
sudo mkdir -p /opt/smart-farm
sudo chown $USER:$USER /opt/smart-farm
cd /opt/smart-farm

# Clone your repositories (replace with your actual GitHub URLs)
echo "📥 Cloning repositories..."
git clone https://github.com/yourusername/smart-farm-backend.git backend
git clone https://github.com/yourusername/smart-farm-frontend.git frontend

# Copy deployment files
cp backend/deploy/docker-compose.production.yml .
cp backend/deploy/nginx.conf .

# Set up environment variables
echo "🔧 Setting up environment..."
cat > .env << EOF
# Domain Configuration
DOMAIN=your-domain.com

# Database Configuration
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
MYSQL_DATABASE=smartfarm_db
MYSQL_USER=smartfarm
MYSQL_PASSWORD=$(openssl rand -base64 32)

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 64)

# MQTT Configuration
MQTT_USERNAME=admin
MQTT_PASSWORD=$(openssl rand -base64 32)
EOF

# Build and start services
echo "🐳 Building and starting services..."
docker-compose -f docker-compose.production.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose -f docker-compose.production.yml ps

# Set up SSL certificate
echo "🔒 Setting up SSL certificate..."
sudo certbot --nginx -d your-domain.com -d www.your-domain.com --non-interactive --agree-tos --email your-email@example.com

# Restart nginx with SSL
sudo systemctl restart nginx

echo "✅ Smart Farm IoT Stack deployed successfully!"
echo ""
echo "🌐 Frontend: https://your-domain.com"
echo "🔧 Backend API: https://your-domain.com/api/"
echo "📡 MQTT Broker: your-domain.com:1883"
echo "📊 MQTT Dashboard: https://your-domain.com/mqtt-dashboard/"
echo ""
echo "🔑 MQTT Dashboard Credentials:"
echo "   Username: admin"
echo "   Password: $(grep MQTT_PASSWORD .env | cut -d '=' -f2)"
echo ""
echo "📋 Next steps:"
echo "1. Update your domain DNS to point to this server"
echo "2. Configure your IoT devices to connect to your-domain.com:1883"
echo "3. Access the MQTT dashboard to monitor connections"
echo "4. Test your Smart Farm application!"
