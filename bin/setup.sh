#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))
BOOT=$ROOT/module/boot
CLI=$ROOT/module/cli
BIN=$ROOT/.bin

rm -rf $BIN
rm -rf $BIN/@travetto/boot/bin
mkdir -p $BIN/@travetto/boot/bin

[[ ! -e "$BOOT/src/fs.js" ]] && tsc -p $BOOT/src-ts;

ln -sf $BOOT/bin/register.js $BIN/@travetto/boot/bin/register.js
ln -sf $BOOT/bin/main.js $BIN/@travetto/boot/bin/main.js
ln -sf $CLI/bin/trv.js $BIN/trv

cd $ROOT
for TS in ./bin/*.ts; do 
  SH=.bin/$(basename -s .ts $TS)
  echo -e "#!/usr/bin/sh\ncd $ROOT\nnode -r @travetto/boot/bin/register $TS \${@}" > $SH
  chmod +x $SH
done