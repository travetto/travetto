#!/bin/bash

# Compile boot
pushd module/boot/src-ts > /dev/null
if [ "$1" == "watch" ]; then
  tsc -w -p . &
else
  tsc -p .
fi
popd > /dev/null

if [ ! "$1" == "watch" ]; then
  pushd module/boot/src > /dev/null
  for f in *.js; do 
    cat $f |\
      sed '/\/\*[* ]/,/*\//d' |\
      perl -pe 's|[ ]//[^`]*$||g' |\
      perl -pe 's|^\s+||g' |\
      perl -pe 's|^$||g' \
      > $f.clean
    mv $f.clean $f
  done
  popd > /dev/null
fi

# Link register
mkdir -p node_modules/@travetto/boot
ln -sf module/boot/register.js node_modules/@travetto/boot/register.js

# Wait for all background jobs
if [ "$1" == "watch" ]; then
  for job in `jobs -p`; do  
    wait $job
  done
fi