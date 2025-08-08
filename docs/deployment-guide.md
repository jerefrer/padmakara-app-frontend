# Deployment Guide - Padmakara App

## Overview
This guide covers the complete deployment process for the Padmakara Buddhist retreat app, from development setup to production deployment on AWS.

## Prerequisites

### Required Tools
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- AWS CLI configured with appropriate credentials
- Terraform or AWS CDK for infrastructure deployment
- Docker for containerized deployments

### AWS Account Setup
1. Create AWS account with appropriate permissions
2. Set up AWS CLI with admin credentials
3. Configure AWS regions (primary: us-east-1, secondary: eu-west-1)
4. Set up AWS Organizations for multi-account strategy (optional)

## Environment Configuration

### Environment Variables
Create environment files for each stage:

**`.env.development`**
```
EXPO_PUBLIC_API_URL=https://dev-api.padmakara.app
EXPO_PUBLIC_WS_URL=wss://dev-api.padmakara.app/ws
EXPO_PUBLIC_CDN_URL=https://dev-cdn.padmakara.app
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_AMPLITUDE_API_KEY=your-amplitude-key
```

**`.env.staging`**
```
EXPO_PUBLIC_API_URL=https://staging-api.padmakara.app
EXPO_PUBLIC_WS_URL=wss://staging-api.padmakara.app/ws
EXPO_PUBLIC_CDN_URL=https://staging-cdn.padmakara.app
EXPO_PUBLIC_ENVIRONMENT=staging
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_AMPLITUDE_API_KEY=your-amplitude-key
```

**`.env.production`**
```
EXPO_PUBLIC_API_URL=https://api.padmakara.app
EXPO_PUBLIC_WS_URL=wss://api.padmakara.app/ws
EXPO_PUBLIC_CDN_URL=https://cdn.padmakara.app
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_AMPLITUDE_API_KEY=your-amplitude-key
```

### AWS Infrastructure Deployment

#### Using Terraform

1. **Initialize Terraform**
```bash
cd infrastructure/terraform
terraform init
```

2. **Plan Deployment**
```bash
terraform plan -var-file="environments/production.tfvars"
```

3. **Deploy Infrastructure**
```bash
terraform apply -var-file="environments/production.tfvars"
```

#### Key Infrastructure Components

**VPC and Networking**
```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "padmakara-vpc"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "padmakara-private-${count.index + 1}"
  }
}
```

**S3 Buckets**
```hcl
resource "aws_s3_bucket" "audio_content" {
  bucket = "padmakara-audio-${var.environment}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "transcripts" {
  bucket = "padmakara-transcripts-${var.environment}"

  lifecycle {
    prevent_destroy = true
  }
}
```

**DynamoDB Tables**
```hcl
resource "aws_dynamodb_table" "users" {
  name           = "padmakara-users-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name     = "EmailIndex"
    hash_key = "email"
  }

  tags = {
    Environment = var.environment
  }
}
```

## Backend Deployment

### Lambda Functions
Deploy serverless functions using AWS SAM or Serverless Framework:

**serverless.yml**
```yaml
service: padmakara-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    DYNAMODB_USERS_TABLE: ${self:custom.usersTable}
    DYNAMODB_PROGRESS_TABLE: ${self:custom.progressTable}
    S3_AUDIO_BUCKET: ${self:custom.audioBucket}
    S3_TRANSCRIPTS_BUCKET: ${self:custom.transcriptsBucket}

functions:
  auth:
    handler: src/handlers/auth.handler
    events:
      - http:
          path: /auth/{proxy+}
          method: ANY
          cors: true

  content:
    handler: src/handlers/content.handler
    events:
      - http:
          path: /content/{proxy+}
          method: ANY
          cors: true

  progress:
    handler: src/handlers/progress.handler
    events:
      - http:
          path: /progress/{proxy+}
          method: ANY
          cors: true

custom:
  usersTable: padmakara-users-${self:provider.stage}
  progressTable: padmakara-progress-${self:provider.stage}
  audioBucket: padmakara-audio-${self:provider.stage}
  transcriptsBucket: padmakara-transcripts-${self:provider.stage}
```

### Deployment Commands
```bash
# Install dependencies
npm install

# Deploy to staging
serverless deploy --stage staging

# Deploy to production
serverless deploy --stage production
```

## Content Delivery Network

### CloudFront Configuration
```json
{
  "DistributionConfig": {
    "CallerReference": "padmakara-cdn",
    "Comment": "Padmakara App CDN",
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3-padmakara-content",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "managed-caching-optimized"
    },
    "Origins": [
      {
        "Id": "S3-padmakara-content",
        "DomainName": "padmakara-content.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/E1234567890"
        }
      }
    ],
    "Enabled": true,
    "PriceClass": "PriceClass_All"
  }
}
```

## Mobile App Deployment

### iOS Deployment

1. **Update App Configuration**
```json
// app.json
{
  "expo": {
    "name": "Padmakara",
    "slug": "padmakara",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.padmakara.app",
      "buildNumber": "1",
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

2. **Build for App Store**
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios --profile production
```

3. **Submit to App Store**
```bash
eas submit --platform ios
```

### Android Deployment

1. **Build for Play Store**
```bash
# Build for Android
eas build --platform android --profile production
```

2. **Submit to Play Store**
```bash
eas submit --platform android
```

### Web Deployment

1. **Build Web Version**
```bash
npx expo export:web
```

2. **Deploy to S3 + CloudFront**
```bash
aws s3 sync web-build/ s3://padmakara-web --delete
aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
```

## Database Setup

### DynamoDB Table Creation
```bash
# Create users table
aws dynamodb create-table \
  --table-name padmakara-users \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --global-secondary-indexes \
    IndexName=EmailIndex,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
```

### Data Migration
```javascript
// migration script
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function migrateData() {
  // Read from source
  const sourceData = require('./data/users.json');
  
  // Transform and insert
  for (const user of sourceData) {
    const params = {
      TableName: 'padmakara-users',
      Item: {
        userId: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        createdAt: new Date().toISOString()
      }
    };
    
    await dynamodb.put(params).promise();
    console.log(`Migrated user: ${user.email}`);
  }
}
```

## Monitoring and Logging

### CloudWatch Setup
```bash
# Create log groups
aws logs create-log-group --log-group-name /aws/lambda/padmakara-auth
aws logs create-log-group --log-group-name /aws/lambda/padmakara-content
aws logs create-log-group --log-group-name /aws/lambda/padmakara-progress

# Create custom metrics
aws cloudwatch put-metric-data \
  --namespace "Padmakara/App" \
  --metric-data MetricName=UserLogins,Value=1,Unit=Count
```

### Application Performance Monitoring

**Sentry Configuration**
```javascript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT,
});
```

## Security Configuration

### AWS WAF Rules
```json
{
  "Rules": [
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      }
    }
  ]
}
```

### SSL Certificate Setup
```bash
# Request certificate
aws acm request-certificate \
  --domain-name api.padmakara.app \
  --subject-alternative-names "*.padmakara.app" \
  --validation-method DNS
```

## Backup and Recovery

### Automated Backups
```yaml
# CloudFormation for automated backups
Resources:
  BackupPlan:
    Type: AWS::Backup::BackupPlan
    Properties:
      BackupPlan:
        BackupPlanName: PadmakaraBackupPlan
        BackupPlanRule:
          - RuleName: DailyBackups
            TargetBackupVault: default
            ScheduleExpression: cron(0 5 ? * * *)
            Lifecycle:
              DeleteAfterDays: 30
```

### Disaster Recovery
```bash
# Cross-region replication for S3
aws s3api put-bucket-replication \
  --bucket padmakara-audio \
  --replication-configuration file://replication.json
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy Padmakara App

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to AWS
        run: |
          aws configure set aws_access_key_id ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws configure set aws_secret_access_key ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          serverless deploy --stage production

  deploy-mobile:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and deploy mobile app
        run: |
          eas build --platform all --profile production --non-interactive
```

## Performance Optimization

### Mobile App Optimization
```javascript
// Bundle splitting for better performance
import { lazy, Suspense } from 'react';

const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProfileScreen />
    </Suspense>
  );
}
```

### API Optimization
```javascript
// Caching strategy
const cache = new Map();

export async function getCachedData(key, fetchFunction, ttl = 300000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check API Gateway CORS configuration
   - Verify Origin headers in requests

2. **Authentication Failures**
   - Validate JWT token expiration
   - Check Cognito User Pool configuration

3. **Performance Issues**
   - Enable CloudWatch detailed monitoring
   - Analyze Lambda cold start times
   - Review DynamoDB read/write capacity

### Debugging Tools
```bash
# CloudWatch Logs Insights queries
aws logs start-query \
  --log-group-name "/aws/lambda/padmakara-auth" \
  --start-time 1640995200 \
  --end-time 1641081600 \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

This deployment guide provides a comprehensive overview of deploying the Padmakara app to production on AWS with proper monitoring, security, and backup strategies.