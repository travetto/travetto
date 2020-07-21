#!/bin/sh
export TRV_SVC_FILES=`find $PWD/module/*/support -name 'service*.js' | tr '\n' ','`
cd module/command
npx trv command:service ${@}