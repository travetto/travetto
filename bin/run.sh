#!/bin/bash
export TRV_DEBUG=0
export TRV_DEV=1
export NODE_PRESERVE_SYMLINKS=1
node -r './module/boot/bin/init' -e 'require("./bin/'$1'").run(...process.argv.slice(1))' "${@:2}"