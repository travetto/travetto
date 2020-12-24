#!/bin/sh
MOD_ROOT=`pwd`/module
ROOT=`pwd`

# Setup common register in dev mode
mkdir -p ${ROOT}/node_modules/@travetto/boot
ln -sf ${MOD_ROOT}/boot/register.js ${ROOT}/node_modules/@travetto/boot/register.js

# Establish modules
for pkg in `npx lerna ls -p -a | grep $ROOT`; do 
  mkdir -p ${pkg}/node_modules/.bin
  ln -sf ${MOD_ROOT}/cli/bin/travetto.js ${pkg}/node_modules/.bin/trv
  ln -sf ${MOD_ROOT}/cli/bin/travetto.js ${pkg}/node_modules/.bin/travetto
done