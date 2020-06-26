#!/bin/sh
export TRV_SVC_FILES=`find $PWD/module/*/support -name 'service*.json' | tr '\n' ','`
cd module/command
npx trv command:service ${@}