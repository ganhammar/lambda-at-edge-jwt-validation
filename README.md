# Using Lambda@Edge as Authorizer for Lambda Function URL

With the [relatively new addition](https://aws.amazon.com/about-aws/whats-new/2024/04/amazon-cloudfront-oac-lambda-function-url-origins/) of Origin Access Control (OAC) for Lambda Function URL origins, it is possible to connect a CloudFront distribution directly with a Lambda function, only allowing it to access the function. This removes the need for using API Gateways in front of the Lambda function, which will lower your overall cloud costs.

With API Gateway, you would typically use an authorizer to authorize a request before the Lambda is invoked, which there is no out-of-the-box support for with only CloudFront and Lambda Function URLs. In this post, we will explore using a Lambda@Edge function as an authorizer to mimic the same behavior. The authorizer will look for an OIDC/OAuth 2.0 authorization token in the request header and validate it, using signing and encryption certificates stored in Systems Manager Parameter Store, to try to keep the external dependencies to a minimum.

A complete blog post explaining how the solution works can be found [here](https://www.ganhammar.se/lambda-at-edge-authorizer).