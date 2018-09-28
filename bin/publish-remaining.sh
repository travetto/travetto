#!/bin/bash
NPM_CONFIG_OTP=$1

for f in `find module -name '*.tgz'`; do 
  P=`echo $f | awk -F '/travetto-' '{ print $1 }'`; 
  pushd $P; 
    npm publish && rm $f; 
  popd; 
done