#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))
BOOT=$ROOT/module/boot
CLI=$ROOT/module/cli
BIN=$ROOT/.bin

rm -rf $BIN
rm -rf $BIN/@travetto
mkdir -p $BIN/@travetto/boot

[[ ! -e "$BOOT/src/fs.js" ]] && npm run boot;

ln -sf $BOOT/bin/ $BIN/@travetto/boot/bin
ln -sf $CLI/bin/trv.js $BIN/trv

cd $ROOT
for TS in ./bin/trv*.ts; do
  SH=.bin/$(basename -s .ts $TS)
  echo -e "#!/usr/bin/sh\ncd $ROOT\nnode -r @travetto/boot/bin/register $TS \${@}" > $SH
  chmod +x $SH
done

npx tsc --outDir $BIN --importHelpers -m commonjs -t ES2020 --lib es2020 $ROOT/bin/dev-register.ts 2> /dev/null