#!/bin/bash
ROOT=`pwd`
ln -sf $ROOT/module/cli/bin/trv.js $ROOT/.bin/trv
npx tsc -p $ROOT/bin/eslint/tsocnfig.json > /dev/null