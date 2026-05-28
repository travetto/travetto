name: openapi-client

on:
  workflow_dispatch:
  pull_request:
    paths:
      - openapi.yml
      - openapi.generated.yml

jobs:
  generate-client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx trv openapi:client --input openapi.yml --output src/client
      - run: git diff --exit-code
