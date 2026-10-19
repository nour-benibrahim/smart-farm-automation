#!/bin/bash

# Smart Farm IoT Stack - Direct Deployment from Cursor
# This script deploys everything directly from your current environment

set -e

echo "🚀 Deploying Smart Farm IoT Stack directly from Cursor..."

# Configuration
DOMAIN_NAME="smartfarm.com"  # Change this to your domain
AWS_REGION="eu-west-1"       # Change to your preferred region
STACK_NAME="smart-farm-stack"

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
check_aws() {
    print_status "Checking AWS CLI..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Installing..."
        # Install AWS CLI on Windows
        if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            curl "https://awscli.amazonaws.com/AWSCLIV2.msi" -o "AWSCLIV2.msi"
            msiexec.exe /i AWSCLIV2.msi /quiet
        else
            curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
            unzip awscliv2.zip
            sudo ./aws/install
        fi
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI not configured. Please run 'aws configure' first."
        print_status "You need:"
        print_status "1. AWS Access Key ID"
        print_status "2. AWS Secret Access Key"
        print_status "3. Default region (eu-west-1)"
        print_status "4. Default output format (json)"
        exit 1
    fi
    
    print_success "AWS CLI is ready"
}

# Generate secure passwords
generate_passwords() {
    print_status "Generating secure passwords..."
    
    if command -v openssl &> /dev/null; then
        DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
    else
        # Fallback for Windows without OpenSSL
        DATABASE_PASSWORD=$(powershell -Command "[System.Web.Security.Membership]::GeneratePassword(25, 5)")
        JWT_SECRET=$(powershell -Command "[System.Web.Security.Membership]::GeneratePassword(50, 10)")
    fi
    
    print_success "Passwords generated"
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying AWS infrastructure..."
    
    # Check if stack already exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null; then
        print_status "Stack exists, updating..."
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://aws/cloudformation-template.yaml \
            --parameters \
                ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME \
                ParameterKey=DatabasePassword,ParameterValue=$DATABASE_PASSWORD \
                ParameterKey=JWTSecret,ParameterValue=$JWT_SECRET \
            --capabilities CAPABILITY_IAM \
            --region $AWS_REGION
        
        aws cloudformation wait stack-update-complete \
            --stack-name $STACK_NAME \
            --region $AWS_REGION
    else
        print_status "Creating new stack..."
        aws cloudformation create-stack \
            --stack-name $STACK_NAME \
            --template-body file://aws/cloudformation-template.yaml \
            --parameters \
                ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME \
                ParameterKey=DatabasePassword,ParameterValue=$DATABASE_PASSWORD \
                ParameterKey=JWTSecret,ParameterValue=$JWT_SECRET \
            --capabilities CAPABILITY_IAM \
            --region $AWS_REGION
        
        aws cloudformation wait stack-create-complete \
            --stack-name $STACK_NAME \
            --region $AWS_REGION
    fi
    
    print_success "Infrastructure deployed"
}

# Build and deploy backend
deploy_backend() {
    print_status "Building and deploying backend..."
    
    # Get ECR repository URI
    ECR_URI=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
        --output text)
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build image
    docker build -t smart-farm-backend .
    
    # Tag and push
    docker tag smart-farm-backend:latest $ECR_URI:latest
    docker push $ECR_URI:latest
    
    # Update ECS service
    aws ecs update-service \
        --cluster smart-farm-cluster \
        --service smart-farm-backend-service \
        --force-new-deployment \
        --region $AWS_REGION
    
    print_success "Backend deployed"
}

# Deploy frontend
deploy_frontend() {
    print_status "Building and deploying frontend..."
    
    # Build frontend
    cd ../smart-farm-frontend
    npm run build:prod
    
    # Get S3 bucket name
    BUCKET_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' \
        --output text)
    
    # Sync to S3
    aws s3 sync dist/smart-farm-frontend/ s3://$BUCKET_NAME --delete
    
    # Invalidate CloudFront
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistribution`].OutputValue' \
        --output text)
    
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*"
    
    print_success "Frontend deployed"
}

# Setup IoT
setup_iot() {
    print_status "Setting up AWS IoT Core..."
    
    # Create IoT policy
    aws iot create-policy \
        --policy-name SmartFarmPolicy \
        --policy-document '{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "iot:Connect",
                        "iot:Publish",
                        "iot:Subscribe",
                        "iot:Receive"
                    ],
                    "Resource": "*"
                }
            ]
        }' \
        --region $AWS_REGION || print_status "IoT policy may already exist"
    
    print_success "IoT Core configured"
}

# Display results
show_results() {
    print_success "🎉 Smart Farm IoT Stack deployed successfully!"
    echo ""
    echo "📋 Your Smart Farm is now live:"
    echo "================================"
    
    # Get URLs
    FRONTEND_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
        --output text)
    
    BACKEND_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`BackendURL`].OutputValue' \
        --output text)
    
    IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $AWS_REGION --query 'endpointAddress' --output text)
    
    echo "🌐 Frontend: $FRONTEND_URL"
    echo "🔧 Backend API: $BACKEND_URL"
    echo "📡 IoT Endpoint: $IOT_ENDPOINT"
    echo ""
    echo "🔑 Database Password: $DATABASE_PASSWORD"
    echo ""
    echo "📱 Next Steps:"
    echo "1. Test your app at: $FRONTEND_URL"
    echo "2. Configure IoT devices to connect to: $IOT_ENDPOINT"
    echo "3. Monitor in AWS Console"
    echo ""
    echo "💰 Estimated Monthly Cost: $38-66"
}

# Main deployment
main() {
    print_status "Starting Smart Farm deployment from Cursor..."
    
    check_aws
    generate_passwords
    deploy_infrastructure
    deploy_backend
    deploy_frontend
    setup_iot
    show_results
    
    print_success "🚀 Deployment completed! Your Smart Farm is live!"
}

# Run deployment
main "$@"
