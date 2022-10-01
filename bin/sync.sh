#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))

pushd $ROOT > /dev/null
  npm run boot
popd > /dev/null
rm -rf node_modules/@travetto/boot
cp -r $ROOT/module/boot node_modules/@travetto/

echo 'process.env.TRV_COMPILED = 1;
process.env.TRV_DEV="";
process.env.TRV_DEV_ROOT="";
process.env.TRV_REQUIRES="";
' > .env.js

function copy_module() {  
  MOD=$1
  TARGET=$2
  cat $ROOT/module/$MOD/package.json | sed 's|"main": "index.ts"|"main": "index.js"|g'  > $TARGET/package.json;
  if [ -e "$ROOT/module/$MOD/bin" ]; then
    mkdir -p $TARGET/bin
    cp $ROOT/module/$MOD/bin/* $TARGET/bin/
  fi
}

# Rewrite package.json files
for x in node_modules/@travetto/*; do 
  copy_module `basename $x` $x
done

cat ../package.json | sed 's|"main": "index.ts"|"main": "index.js"|g'  > package.json;
