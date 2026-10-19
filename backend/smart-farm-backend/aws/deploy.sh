#!/bin/bash

# AWS Smart Farm IoT Stack Deployment Script
# This script deploys the complete Smart Farm application to AWS

set -e

echo "🚀 Starting AWS Smart Farm IoT Stack Deployment..."

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

# Function to print colored output
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

# Check if AWS CLI is installed and configured
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "AWS CLI is configured correctly"
}

# Generate random passwords
generate_passwords() {
    print_status "Generating secure passwords..."
    
    DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
    
    print_success "Passwords generated"
}

# Deploy CloudFormation stack
deploy_infrastructure() {
    print_status "Deploying AWS infrastructure with CloudFormation..."
    
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body file://aws/cloudformation-template.yaml \
        --parameters \
            ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME \
            ParameterKey=DatabasePassword,ParameterValue=$DATABASE_PASSWORD \
            ParameterKey=JWTSecret,ParameterValue=$JWT_SECRET \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION
    
    print_status "Waiting for CloudFormation stack to complete..."
    aws cloudformation wait stack-create-complete \
        --stack-name $STACK_NAME \
        --region $AWS_REGION
    
    print_success "Infrastructure deployed successfully"
}

# Build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image to ECR..."
    
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
    
    # Tag image
    docker tag smart-farm-backend:latest $ECR_URI:latest
    
    # Push image
    docker push $ECR_URI:latest
    
    print_success "Docker image pushed to ECR"
}

# Update ECS service
update_ecs_service() {
    print_status "Updating ECS service with new image..."
    
    # Get cluster name
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSCluster`].OutputValue' \
        --output text)
    
    # Force new deployment
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service smart-farm-backend-service \
        --force-new-deployment \
        --region $AWS_REGION
    
    print_success "ECS service updated"
}

# Deploy frontend to S3
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
    
    # Invalidate CloudFront cache
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistribution`].OutputValue' \
        --output text)
    
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*"
    
    print_success "Frontend deployed successfully"
}

# Setup AWS IoT Core
setup_iot_core() {
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
        --region $AWS_REGION || print_warning "IoT policy may already exist"
    
    # Get IoT endpoint
    IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $AWS_REGION --query 'endpointAddress' --output text)
    
    print_success "AWS IoT Core configured"
    print_status "IoT Endpoint: $IOT_ENDPOINT"
}

# Display deployment information
display_info() {
    print_success "🎉 Smart Farm IoT Stack deployed successfully!"
    echo ""
    echo "📋 Deployment Information:"
    echo "=========================="
    
    # Get outputs
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
    
    DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)
    
    IOT_ENDPOINT=$(aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $AWS_REGION --query 'endpointAddress' --output text)
    
    echo "🌐 Frontend URL: $FRONTEND_URL"
    echo "🔧 Backend API: $BACKEND_URL"
    echo "🗄️  Database: $DATABASE_ENDPOINT"
    echo "📡 IoT Endpoint: $IOT_ENDPOINT"
    echo ""
    echo "🔑 Database Credentials:"
    echo "   Username: smartfarm"
    echo "   Password: $DATABASE_PASSWORD"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Configure your domain DNS to point to AWS"
    echo "2. Update your IoT devices to connect to: $IOT_ENDPOINT"
    echo "3. Test your Smart Farm application at: $FRONTEND_URL"
    echo "4. Monitor your application in AWS Console"
    echo ""
    echo "💰 Estimated Monthly Cost: $25-50"
    echo "📊 Monitor costs in AWS Cost Explorer"
}

# Main deployment function
main() {
    print_status "Starting Smart Farm IoT Stack deployment to AWS..."
    
    # Check prerequisites
    check_aws_cli
    generate_passwords
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Build and deploy backend
    build_and_push_image
    update_ecs_service
    
    # Deploy frontend
    deploy_frontend
    
    # Setup IoT
    setup_iot_core
    
    # Display information
    display_info
    
    print_success "🚀 Deployment completed successfully!"
}

# Run main function
main "$@"
