#!/bin/bash -x
CMD="./node_modules/mocha/bin/mocha"
CMD="$CMD --delay"
ENV=${ENV:-test}

if [[ -e './node_modules/@encore/init' ]]; then
  CMD="$CMD --require node_modules/@encore/init/bootstrap.js"
else
  CMD="$CMD --require node_modules/@encore/base/src/lib/require-ts.js"
fi

if [[ -e "./src/test/setup.ts" ]]; then
  CMD="$CMD --require src/test/setup"
fi

CMD="$CMD --ui @encore/test/src/lib/user-interface"

auto=true $CMD $@