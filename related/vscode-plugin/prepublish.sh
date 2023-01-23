#!/bin/sh
cp ../../LICENSE . 
npx trv build
ls out/node_modules/@travetto | grep -v 'base' | grep -v 'manifest' | awk '{print "out/node_modules/@travetto/"$0 }' | xargs rm -rf 