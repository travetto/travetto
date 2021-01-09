#!/bin/sh
for f in src/*.js; do 
  cat $f |\
    sed '/\/\*[* ]/,/*\//d' |\
    perl -pe 's|[ ]//[^`]*$||g' |\
    perl -pe 's|^\s+||g' |\
    perl -pe 's|^$||g' \
    > $f.clean
  mv $f.clean $f
done
