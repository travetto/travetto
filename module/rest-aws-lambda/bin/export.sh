#!/bin/bash
CWD=`pwd`
DIST=/tmp/lambda-dist
ZIP=$CWD/lambda.zip

rm -rf $DIST/ $ZIP
mkdir -p $DIST
cp -r * $DIST

# Prime Scan files
pushd $DIST

echo 'process.env.TS_CACHE_DIR = `${__dirname}/cache`' > ./index.js
cat $CWD/node_modules/@travetto/rest-aws-lambda/bin/lambda.js |\
  sed -e 's|../src|@travetto/rest-aws-lambda|g' >> ./index.js

npx travetto compile -o ./cache -r '/var/task'

rm -rf node_modules/typescript
mkdir node_modules/typescript
echo 'module.exports = {};' > node_modules/typescript/index.js

# Clean up unused pieces
rm -rf node_modules/@types
rm -rf node_modules/bson/browser_build
rm -rf node_modules/source-map-support/browser-source-map-support.js
rm -f package-lock.json

find node_modules -name 'dist' -type d | xargs rm -rf
find node_modules -name '*.d.ts' | xargs rm -f
find node_modules -name '*.md' | xargs rm -f
find node_modules -name '*.lock' | xargs rm -f
find node_modules -name 'bower.json' | xargs rm -f

zip -qr $ZIP . -x '*.git*' -x '*e2e*' -x '*test*'
popd