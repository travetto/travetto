#!/bin/sh
npx eslint \
  --ignore-pattern '**/*.spec.ts' \
  --ignore-pattern '**/out/**' \
  --ignore-pattern '**/api-client/**' \
  --ignore-pattern '**/build/**' \
  --ignore-pattern '**/dist/**' \
  --ignore-pattern '**/node_modules/**' \
  --ext .js \
  --ext .ts \
  .