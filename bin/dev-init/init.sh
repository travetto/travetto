#!/bin/bash
export QUIET_INIT=1
export DEBUG=0
node -e 'require("./module/base/bin/bootstrap"); require("./bin/dev-init").init()';