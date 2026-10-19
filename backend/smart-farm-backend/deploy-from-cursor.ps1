# Smart Farm IoT Stack - Direct Deployment from Cursor (PowerShell)
# This script deploys everything directly from your Windows Cursor environment

param(
    [string]$DomainName = "smartfarm.com",
    [string]$AWSRegion = "eu-west-1",
    [string]$StackName = "smart-farm-stack"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# Check AWS CLI
function Test-AWSCLI {
    Write-Status "Checking AWS CLI..."
    
    try {
        $null = aws --version
        Write-Success "AWS CLI is installed"
    }
    catch {
        Write-Error "AWS CLI not found. Please install it first:"
        Write-Status "1. Download from: https://awscli.amazonaws.com/AWSCLIV2.msi"
        Write-Status "2. Install the MSI file"
        Write-Status "3. Restart Cursor"
        exit 1
    }
    
    try {
        $null = aws sts get-caller-identity
        Write-Success "AWS CLI is configured"
    }
    catch {
        Write-Error "AWS CLI not configured. Please run 'aws configure' first."
        Write-Status "You need:"
        Write-Status "1. AWS Access Key ID"
        Write-Status "2. AWS Secret Access Key"
        Write-Status "3. Default region (eu-west-1)"
        Write-Status "4. Default output format (json)"
        exit 1
    }
}

# Generate passwords
function New-SecurePasswords {
    Write-Status "Generating secure passwords..."
    
    $DatabasePassword = [System.Web.Security.Membership]::GeneratePassword(25, 5)
    $JWTSecret = [System.Web.Security.Membership]::GeneratePassword(50, 10)
    
    Write-Success "Passwords generated"
    return @{
        DatabasePassword = $DatabasePassword
        JWTSecret = $JWTSecret
    }
}

# Deploy infrastructure
function Deploy-Infrastructure {
    param($Passwords)
    
    Write-Status "Deploying AWS infrastructure..."
    
    # Check if stack exists
    try {
        $null = aws cloudformation describe-stacks --stack-name $StackName --region $AWSRegion
        Write-Status "Stack exists, updating..."
        
        aws cloudformation update-stack `
            --stack-name $StackName `
            --template-body file://aws/cloudformation-template.yaml `
            --parameters `
                ParameterKey=DomainName,ParameterValue=$DomainName `
                ParameterKey=DatabasePassword,ParameterValue=$Passwords.DatabasePassword `
                ParameterKey=JWTSecret,ParameterValue=$Passwords.JWTSecret `
            --capabilities CAPABILITY_IAM `
            --region $AWSRegion
        
        aws cloudformation wait stack-update-complete --stack-name $StackName --region $AWSRegion
    }
    catch {
        Write-Status "Creating new stack..."
        
        aws cloudformation create-stack `
            --stack-name $StackName `
            --template-body file://aws/cloudformation-template.yaml `
            --parameters `
                ParameterKey=DomainName,ParameterValue=$DomainName `
                ParameterKey=DatabasePassword,ParameterValue=$Passwords.DatabasePassword `
                ParameterKey=JWTSecret,ParameterValue=$Passwords.JWTSecret `
            --capabilities CAPABILITY_IAM `
            --region $AWSRegion
        
        aws cloudformation wait stack-create-complete --stack-name $StackName --region $AWSRegion
    }
    
    Write-Success "Infrastructure deployed"
}

# Deploy backend
function Deploy-Backend {
    Write-Status "Building and deploying backend..."
    
    # Get ECR repository URI
    $ECRURI = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $AWSRegion `
        --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' `
        --output text
    
    # Login to ECR
    aws ecr get-login-password --region $AWSRegion | docker login --username AWS --password-stdin $ECRURI
    
    # Build and push image
    docker build -t smart-farm-backend .
    docker tag smart-farm-backend:latest "$ECRURI`:latest"
    docker push "$ECRURI`:latest"
    
    # Update ECS service
    aws ecs update-service `
        --cluster smart-farm-cluster `
        --service smart-farm-backend-service `
        --force-new-deployment `
        --region $AWSRegion
    
    Write-Success "Backend deployed"
}

# Deploy frontend
function Deploy-Frontend {
    Write-Status "Building and deploying frontend..."
    
    # Build frontend
    Set-Location "../smart-farm-frontend"
    npm run build:prod
    
    # Get S3 bucket name
    $BucketName = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $AWSRegion `
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' `
        --output text
    
    # Sync to S3
    aws s3 sync dist/smart-farm-frontend/ "s3://$BucketName" --delete
    
    # Invalidate CloudFront
    $DistributionID = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $AWSRegion `
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistribution`].OutputValue' `
        --output text
    
    aws cloudfront create-invalidation `
        --distribution-id $DistributionID `
        --paths "/*"
    
    Write-Success "Frontend deployed"
}

# Setup IoT
function Set-IoT {
    Write-Status "Setting up AWS IoT Core..."
    
    # Create IoT policy
    $PolicyDocument = @'
{
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
}
'@
    
    try {
        aws iot create-policy --policy-name SmartFarmPolicy --policy-document $PolicyDocument --region $AWSRegion
    }
    catch {
        Write-Status "IoT policy may already exist"
    }
    
    Write-Success "IoT Core configured"
}

# Show results
function Show-Results {
    param($Passwords)
    
    Write-Success "🎉 Smart Farm IoT Stack deployed successfully!"
    Write-Host ""
    Write-Host "📋 Your Smart Farm is now live:" -ForegroundColor $Green
    Write-Host "================================" -ForegroundColor $Green
    Write-Host ""
    
    # Get URLs
    $FrontendURL = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $AWSRegion `
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' `
        --output text
    
    $BackendURL = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $AWSRegion `
        --query 'Stacks[0].Outputs[?OutputKey==`BackendURL`].OutputValue' `
        --output text
    
    $IoTEndpoint = aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $AWSRegion --query 'endpointAddress' --output text
    
    Write-Host "🌐 Frontend: $FrontendURL" -ForegroundColor $Blue
    Write-Host "🔧 Backend API: $BackendURL" -ForegroundColor $Blue
    Write-Host "📡 IoT Endpoint: $IoTEndpoint" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "🔑 Database Password: $($Passwords.DatabasePassword)" -ForegroundColor $Yellow
    Write-Host ""
    Write-Host "📱 Next Steps:" -ForegroundColor $Green
    Write-Host "1. Test your app at: $FrontendURL"
    Write-Host "2. Configure IoT devices to connect to: $IoTEndpoint"
    Write-Host "3. Monitor in AWS Console"
    Write-Host ""
    Write-Host "💰 Estimated Monthly Cost: `$38-66" -ForegroundColor $Yellow
}

# Main deployment
function Start-Deployment {
    Write-Status "Starting Smart Farm deployment from Cursor..."
    
    Test-AWSCLI
    $Passwords = New-SecurePasswords
    Deploy-Infrastructure -Passwords $Passwords
    Deploy-Backend
    Deploy-Frontend
    Set-IoT
    Show-Results -Passwords $Passwords
    
    Write-Success "🚀 Deployment completed! Your Smart Farm is live!"
}

# Run deployment
Start-Deployment
