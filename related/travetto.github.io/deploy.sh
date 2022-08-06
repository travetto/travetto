#!/bin/sh
rm -rf dist/*
npx ng build -c production
aws s3 sync --exclude index.html --metadata-directive REPLACE --cache-control 'public,max-age=31557600' dist/ s3://travetto-website
aws s3 sync --include index.html dist/ s3://travetto-website
aws cloudfront create-invalidation --distribution-id E340S3PX1SNG1Y --paths '/*'
