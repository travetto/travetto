#!/bin/sh

ROOT=$(realpath $(dirname $(dirname $0)))
rm -rf $ROOT/node_modules/@travetto/boot/bin $ROOT/.bin
mkdir -p $ROOT/node_modules/@travetto/boot/bin
mkdir -p $ROOT/.bin

ln -sf $ROOT/module/boot/bin/register.js $ROOT/node_modules/@travetto/boot/bin/register.js
ln -sf $ROOT/module/boot/bin/main.js $ROOT/node_modules/@travetto/boot/bin/main.js
ln -sf $ROOT/module/cli/bin/trv.js $ROOT/.bin/trv

for TS in `find $ROOT/bin -maxdepth 1 -name '*.ts'`; do 
  SH=`echo "$TS" | sed -e 's|bin/|.bin/|' -e 's|[.]ts$||'`
  echo "#!/usr/bin/sh\n node -r @travetto/boot/bin/register $TS \${@}" > $SH
  chmod +x $SH
done