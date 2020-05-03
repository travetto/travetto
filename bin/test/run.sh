#!/bin/bash
mkdir -p bin/test/model

for x in module/test/src/model/*.ts; do
  NAME=`basename $x`
  cat $x | sed -e 's|import.*Class.*|interface Class<T = any> { new (...args: any[]): T }|g' > bin/test/model/$NAME
done

export DEBUG=0
export TRV_DEV=1
export NODE_PRESERVE_SYMLINKS=1
node -r './module/boot/bin/init' -e 'require("./bin/test").run()';