name: lambda-deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: Deployment environment
        required: true
        default: dev

jobs:
  package:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx trv pack:lambda --output dist/lambda
      - uses: actions/upload-artifact@v4
        with:
          name: lambda-package
          path: dist/lambda

  deploy:
    needs: package
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: lambda-package
          path: dist/lambda
      - run: echo "Deploy dist/lambda to AWS Lambda for ${{ inputs.environment }}"
