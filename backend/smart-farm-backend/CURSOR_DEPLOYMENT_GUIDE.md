# 🚀 Smart Farm IoT Stack - One-Command Deployment from Cursor

## **Quick Deploy (3 Steps):**

### **Step 1: Configure AWS CLI**
```bash
# In Cursor terminal, run:
aws configure
# Enter your AWS credentials when prompted
```

### **Step 2: Deploy Everything**
```bash
# Navigate to backend directory
cd smart-farm-backend

# Make script executable (Linux/Mac)
chmod +x deploy-from-cursor.sh

# Run deployment (Linux/Mac)
./deploy-from-cursor.sh

# OR for Windows PowerShell:
powershell -ExecutionPolicy Bypass -File deploy-from-cursor.ps1
```

### **Step 3: Test Your App**
```bash
# Your Smart Farm will be live at:
# Frontend: https://smartfarm.com
# Backend: https://api.smartfarm.com
# IoT: your-iot-endpoint.iot.eu-west-1.amazonaws.com
```

---

## **What Happens During Deployment:**

1. **✅ Checks AWS CLI** - Verifies you're logged in
2. **✅ Creates Infrastructure** - VPC, ECS, RDS, S3, CloudFront
3. **✅ Builds Backend** - Docker image → ECR → ECS Fargate
4. **✅ Builds Frontend** - Angular app → S3 → CloudFront CDN
5. **✅ Configures IoT** - AWS IoT Core for MQTT
6. **✅ Shows Results** - URLs and connection info

---

## **Prerequisites:**

- [ ] AWS Account created
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS CLI configured (`aws configure`)
- [ ] Docker installed (`docker --version`)
- [ ] Node.js installed (`node --version`)

---

## **Troubleshooting:**

### **AWS CLI Not Found:**
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.msi" -o "AWSCLIV2.msi"
msiexec.exe /i AWSCLIV2.msi /quiet
```

### **Docker Not Found:**
```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

### **Permission Denied:**
```bash
# Make script executable
chmod +x deploy-from-cursor.sh
```

---

## **Expected Output:**

```
🚀 Deploying Smart Farm IoT Stack directly from Cursor...
[INFO] Checking AWS CLI...
[SUCCESS] AWS CLI is ready
[INFO] Generating secure passwords...
[SUCCESS] Passwords generated
[INFO] Deploying AWS infrastructure...
[SUCCESS] Infrastructure deployed
[INFO] Building and deploying backend...
[SUCCESS] Backend deployed
[INFO] Building and deploying frontend...
[SUCCESS] Frontend deployed
[INFO] Setting up AWS IoT Core...
[SUCCESS] IoT Core configured
[SUCCESS] 🎉 Smart Farm IoT Stack deployed successfully!

📋 Your Smart Farm is now live:
================================
🌐 Frontend: https://smartfarm.com
🔧 Backend API: https://api.smartfarm.com
📡 IoT Endpoint: your-iot-endpoint.iot.eu-west-1.amazonaws.com

🔑 Database Password: [generated-password]

📱 Next Steps:
1. Test your app at: https://smartfarm.com
2. Configure IoT devices to connect to: your-iot-endpoint.iot.eu-west-1.amazonaws.com
3. Monitor in AWS Console

💰 Estimated Monthly Cost: $38-66
[SUCCESS] 🚀 Deployment completed! Your Smart Farm is live!
```

---

## **After Deployment:**

1. **🌐 Test Frontend:** Visit your domain
2. **🔧 Test Backend:** Check API health endpoint
3. **📡 Configure IoT:** Update device MQTT settings
4. **📊 Monitor:** Check AWS Console for metrics
5. **💰 Monitor Costs:** Set up billing alerts

**Your Smart Farm IoT stack is now live and ready to serve farmers worldwide!** 🌱🚀
