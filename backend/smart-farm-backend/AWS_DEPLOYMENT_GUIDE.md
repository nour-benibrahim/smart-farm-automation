# 🚀 AWS Smart Farm IoT Stack - Step-by-Step Deployment Guide

## 📋 **Prerequisites**

### **1. AWS Account Setup**
- [ ] AWS Account created
- [ ] Billing alerts configured
- [ ] AWS CLI installed and configured
- [ ] Domain name ready (optional)

### **2. Local Requirements**
- [ ] Docker installed
- [ ] Node.js and npm installed
- [ ] Git configured

---

## **Step 1: AWS Account Configuration**

### **1.1 Create AWS Account**
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Complete registration with credit card
4. **Important:** Enable billing alerts at $10, $25, $50

### **1.2 Configure AWS CLI**
```bash
# Install AWS CLI (if not installed)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter:
# - Access Key ID: (from AWS Console > IAM > Users > Security credentials)
# - Secret Access Key: (from AWS Console > IAM > Users > Security credentials)
# - Default region: eu-west-1 (or your preferred region)
# - Default output format: json
```

### **1.3 Create IAM User (Recommended)**
1. Go to AWS Console > IAM > Users
2. Click "Create user"
3. Username: `smart-farm-deployer`
4. Attach policies:
   - `AdministratorAccess` (for full deployment)
   - Or create custom policy with specific permissions
5. Create access key and download credentials

---

## **Step 2: Prepare Your Code**

### **2.1 Push Code to GitHub**
```bash
# In smart-farm-backend directory
git add .
git commit -m "AWS deployment ready"
git push origin main

# In smart-farm-frontend directory
cd ../smart-farm-frontend
git add .
git commit -m "Production ready frontend"
git push origin main
```

### **2.2 Update Configuration**
```bash
# Update domain name in deployment script
cd smart-farm-backend/aws
nano deploy.sh
# Change DOMAIN_NAME="your-domain.com"
```

---

## **Step 3: Deploy Infrastructure**

### **3.1 Run Deployment Script**
```bash
# Make script executable
chmod +x aws/deploy.sh

# Run deployment
./aws/deploy.sh
```

### **3.2 Manual CloudFormation Deployment (Alternative)**
```bash
# Deploy infrastructure
aws cloudformation create-stack \
    --stack-name smart-farm-stack \
    --template-body file://aws/cloudformation-template.yaml \
    --parameters \
        ParameterKey=DomainName,ParameterValue=your-domain.com \
        ParameterKey=DatabasePassword,ParameterValue=your-secure-password \
        ParameterKey=JWTSecret,ParameterValue=your-jwt-secret \
    --capabilities CAPABILITY_IAM \
    --region eu-west-1
```

---

## **Step 4: Deploy Backend**

### **4.1 Build and Push Docker Image**
```bash
# Get ECR repository URI
ECR_URI=$(aws cloudformation describe-stacks \
    --stack-name smart-farm-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
    --output text)

# Login to ECR
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin $ECR_URI

# Build and push image
docker build -t smart-farm-backend .
docker tag smart-farm-backend:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### **4.2 Update ECS Service**
```bash
# Force new deployment
aws ecs update-service \
    --cluster smart-farm-cluster \
    --service smart-farm-backend-service \
    --force-new-deployment \
    --region eu-west-1
```

---

## **Step 5: Deploy Frontend**

### **5.1 Build Frontend**
```bash
cd ../smart-farm-frontend
npm run build:prod
```

### **5.2 Deploy to S3**
```bash
# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name smart-farm-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' \
    --output text)

# Sync to S3
aws s3 sync dist/smart-farm-frontend/ s3://$BUCKET_NAME --delete
```

### **5.3 Invalidate CloudFront Cache**
```bash
# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name smart-farm-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistribution`].OutputValue' \
    --output text)

# Create invalidation
aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*"
```

---

## **Step 6: Configure Domain (Optional)**

### **6.1 If You Have a Domain**
1. Go to Route 53 in AWS Console
2. Find your hosted zone
3. Update DNS records to point to AWS
4. SSL certificate will be automatically provisioned

### **6.2 If You Don't Have a Domain**
- Use the CloudFront distribution URL
- Example: `d1234567890.cloudfront.net`

---

## **Step 7: Configure IoT Devices**

### **7.1 Get IoT Endpoint**
```bash
# Get IoT endpoint
IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --query 'endpointAddress' --output text)
echo "IoT Endpoint: $IOT_ENDPOINT"
```

### **7.2 Update Device Configuration**
Update your IoT devices to connect to:
- **MQTT Broker:** `$IOT_ENDPOINT:8883` (secure)
- **WebSocket:** `$IOT_ENDPOINT:443` (secure)

---

## **Step 8: Test Deployment**

### **8.1 Check Services**
```bash
# Check CloudFormation stack
aws cloudformation describe-stacks --stack-name smart-farm-stack

# Check ECS service
aws ecs describe-services --cluster smart-farm-cluster --services smart-farm-backend-service

# Check S3 bucket
aws s3 ls s3://your-domain.com-frontend/
```

### **8.2 Test URLs**
- **Frontend:** `https://your-domain.com`
- **Backend API:** `https://api.your-domain.com/api/v1/health`
- **IoT Dashboard:** AWS Console > IoT Core

---

## **Step 9: Monitor and Maintain**

### **9.1 Set Up Monitoring**
1. Go to CloudWatch in AWS Console
2. Set up alarms for:
   - ECS service health
   - RDS database performance
   - Application Load Balancer metrics

### **9.2 Cost Monitoring**
1. Go to AWS Cost Explorer
2. Set up billing alerts
3. Monitor monthly costs

---

## **💰 Cost Breakdown**

| Service | Monthly Cost | Description |
|---------|-------------|-------------|
| **ECS Fargate** | $8-15 | Backend hosting |
| **RDS MySQL** | $12-20 | Database |
| **S3 + CloudFront** | $1-5 | Frontend hosting |
| **Application Load Balancer** | $16 | Load balancing |
| **Route 53** | $0.50 | DNS |
| **IoT Core** | $1-10 | MQTT broker |
| **Total** | **$38-66/month** | Complete stack |

---

## **🔧 Troubleshooting**

### **Common Issues:**

1. **CloudFormation Stack Fails**
   - Check IAM permissions
   - Verify region settings
   - Check resource limits

2. **ECS Service Won't Start**
   - Check task definition
   - Verify security groups
   - Check CloudWatch logs

3. **Frontend Not Loading**
   - Check S3 bucket policy
   - Verify CloudFront distribution
   - Check domain configuration

4. **Database Connection Issues**
   - Check security groups
   - Verify RDS endpoint
   - Check database credentials

---

## **🎉 Success!**

Your Smart Farm IoT Stack is now deployed on AWS with:
- ✅ **Professional infrastructure**
- ✅ **Auto-scaling capabilities**
- ✅ **Global CDN**
- ✅ **Managed MQTT broker**
- ✅ **Secure database**
- ✅ **SSL certificates**
- ✅ **Monitoring and logging**

**Your Smart Farm is now live and ready to serve farmers worldwide!** 🌱🚀
