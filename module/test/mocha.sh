#!/bin/sh
CMD="./node_modules/mocha/bin/mocha"
CMD="$CMD --delay"
CMD="$CMD --require node_modules/@encore/base/src/lib/require-ts.js"

if [[ -e "./src/test/setup.ts" ]]; then
  CMD="$CMD --require src/test/setup"
fi

CMD="$CMD --ui @encore/test/src/lib/user-interface"

$CMD $@