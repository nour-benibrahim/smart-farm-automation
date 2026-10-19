# Complete IoT Stack Deployment Script
#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Create application directory
sudo mkdir -p /opt/smart-farm
sudo chown $USER:$USER /opt/smart-farm
cd /opt/smart-farm

echo "✅ System setup complete!"
echo "📁 Application directory: /opt/smart-farm"
echo "🐳 Docker installed and ready"
echo "🌐 Nginx installed and ready"
