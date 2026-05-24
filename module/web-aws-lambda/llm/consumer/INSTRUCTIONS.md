# Web Aws Lambda Instructions
How to run Travetto web APIs on AWS Lambda.

## Setup
1. Install @travetto/web-aws-lambda.
2. Keep your web controllers/services as normal Travetto web code.
3. Configure Lambda packaging options (entrypoint/output/module).

## Usage Workflow
- Use `trv pack:lambda` to build deployment artifacts.
- Deploy artifact to AWS Lambda with API Gateway/event integration.
- Validate environment variables/resources expected by your app.

Minimal pattern:
1. Implement web endpoints.
2. Build lambda package.
3. Deploy and verify request/response mapping.

## Safe Defaults
- Keep packaging config explicit in automation.
- Revalidate non-streaming response behavior.
- Keep Lambda runtime configuration aligned with app requirements.
