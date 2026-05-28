name: openapi-spec

on:
  push:
    branches: [main]
  pull_request:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx trv openapi:spec --format yaml --output openapi.generated.yml
      - uses: actions/upload-artifact@v4
        with:
          name: openapi-spec
          path: openapi.generated.yml
