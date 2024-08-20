#!/bin/bash

stack_name="lambda-at-edge-jwt-validation"

# Deploy the authorizer Lambda function stack
sam build --template-file template-authorizer.yml
sam deploy --region us-east-1 --no-fail-on-empty-changeset --stack-name $stack_name
lambda_arn=$(aws cloudformation describe-stacks --region us-east-1 --stack-name $stack_name --query "Stacks[0].Outputs[?OutputKey=='AuthorizerFunctionVersionArn'].OutputValue" --output text)

# Deploy the CloudFront distribution stack
sam build --template-file template-distribution.yml
sam deploy --region eu-north-1 --parameter-overrides AuthorizerFunctionVersionArn=$lambda_arn --no-fail-on-empty-changeset --stack-name $stack_name