#!/bin/bash
NPM_CONFIG_OTP=$1

for f in `find module -name '*.tgz'`; do 
  P=`echo $f | awk -F '/travetto-' '{ print $1 }'`; 
  F=`echo $f | awk -F '/' '{ print $NF }'`;
  pushd $P; 
    NPM_CONFIG_OTP=$1 npm publish && rm $F; 
  popd; 
done