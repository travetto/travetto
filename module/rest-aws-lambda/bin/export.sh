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

zip -qr $ZIP . -x '*.git*' -x '*e2e*' -x '*test*'
popd