#!/bin/bash

stack_name="lambda-at-edge-jwt-validation"

sam build --template-file template-lambda.yml
sam deploy --region us-east-1 --no-fail-on-empty-changeset --stack-name $stack_name
lambda_arn=$(aws cloudformation describe-stacks --region us-east-1 --stack-name $stack_name --query "Stacks[0].Outputs[?OutputKey=='AuthorizerFunctionVersionArn'].OutputValue" --output text)

sam build --template-file template-distribution.yml
sam deploy --region eu-north-1 --parameter-overrides LambdaFunctionVersionArn=$lambda_arn --no-fail-on-empty-changeset --stack-name $stack_name
bucket_name=$(aws cloudformation describe-stacks --region eu-north-1 --stack-name $stack_name --query "Stacks[0].Outputs[?OutputKey=='PrivateWebBucketName'].OutputValue" --output text)

aws s3 sync ./src/assets s3://$bucket_name
