#!/bin/sh
CMD="mocha --require node_modules/@encore/base/src/lib/require-ts.js"
CMD="$CMD --ui @encore/test/src/lib/user-interface"

if [[ -e "./src/test/index.js" ]]; then
  CMD="$CMD --require src/test"
fi

if [[ "$1" == "bamboo" ]]; then
  $CMD -r json src/test/**/*.ts > mocha.json
elif [[ $# -eq 0 ]]; then
  $CMD src/test/**/*.ts
else 
  $CMD $@
fi