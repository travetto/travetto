name: Deploy UI (CloudFront)

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-ui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: echo "Sync to S3 and invalidate CloudFront here"
