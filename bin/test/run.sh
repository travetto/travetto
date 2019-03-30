#!/bin/bash
mkdir -p bin/test/model

for x in module/test/src/model/*.ts; do
  NAME=`basename $x`
  cat $x | sed -e 's|import.*Class.*|interface Class<T = any> { new (...args:any[]): T }|g' > bin/test/model/$NAME
done

export QUIET_INIT=1
export DEBUG=0
node -e 'require("./module/boot/bin/boot"); require("./bin/test").run()';