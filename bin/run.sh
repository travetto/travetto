#!/bin/bash
export TRV_DEBUG=0
node -r './module/boot/register' -e 'require("./bin/'$1'").run(...process.argv.slice(1))' "${@:2}"