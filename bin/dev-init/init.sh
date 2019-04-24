#!/bin/sh
DEBUG=0 node -r './module/boot/bin/init' -e 'require("./bin/dev-init").init()'