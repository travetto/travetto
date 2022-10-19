#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))
CLI=$ROOT/module/cli
BIN=$ROOT/.bin

rm -rf $BIN
npx tsc -p $ROOT/bin/tsconfig.json 2>&1 > /dev/null
for x in $BIN/trv-*.js; do
  OUT=$(echo $x | awk -F '.js' '{print $1}')
  sed "1,1s|^|#!/usr/bin/env node\n|" $x > $OUT
  chmod +x $OUT
  rm $x
done

ln -sf $CLI/bin/trv.js $BIN/trv