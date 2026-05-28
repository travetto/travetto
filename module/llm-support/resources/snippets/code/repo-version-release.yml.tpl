name: repo-version-release

on:
  workflow_dispatch:
    inputs:
      mode:
        description: Release mode
        required: true
        default: changed
      level:
        description: Semver level
        required: true
        default: patch

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx trv repo:version --mode "${{ inputs.mode }}" --level "${{ inputs.level }}"
      - run: git status --short
