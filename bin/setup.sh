#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))

rm -rf $ROOT/.bin/@travetto/boot/bin
mkdir -p $ROOT/.bin/@travetto/boot/bin

[[ ! -e "$ROOT/module/boot/src/fs.js" ]] && tsc -p $ROOT/module/boot/src-ts;

ln -sf $ROOT/module/boot/bin/register.js $ROOT/.bin/@travetto/boot/bin/register.js
ln -sf $ROOT/module/boot/bin/main.js $ROOT/.bin/@travetto/boot/bin/main.js
ln -sf $ROOT/module/cli/bin/trv.js $ROOT/.bin/trv

for TS in $ROOT/bin/*.ts; do 
  SH=.bin/$(basename -s .ts $TS)
  echo -e "#\!/usr/bin/sh\n node -r @travetto/boot/bin/register $TS \${@}" > $SH
  chmod +x $SH
done