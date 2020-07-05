#!/bin/bash
export TRV_DEBUG=0
export TRV_BOOT=`pwd`/module/boot
node -r './module/boot/register' -e 'require("./bin/'$1'").run(...process.argv.slice(1))' "${@:2}"