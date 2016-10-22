#!/bin/sh
CMD="mocha"
CMD="$CMD --delay"
CMD="$CMD --require node_modules/@encore/base/src/lib/require-ts.js"

if [[ -e "./src/test/setup.ts" ]]; then
  CMD="$CMD --require src/test/setup"
fi

CMD="$CMD --ui @encore/test/src/lib/user-interface"

if [[ "$1" == "bamboo" ]]; then
  $CMD -r json src/test/**/*.ts > mocha.json
elif [[ $# -eq 0 ]]; then
  $CMD src/test/**/*.ts
else 
  $CMD $@
fi