#!/bin/sh
CMD="mocha --require node_modules/@encore/base/src/lib/require-ts.js"

if [[ -e "./src/test/index.js" ]]; then
  CMD="$CMD --require src/test"
fi

if [[ "$1" == "all" ]]; then
  $CMD src/test/**/*.ts
elif [[ "$1" == "bamboo" ]]; then
  $CMD -r json src/test/**/*.ts > mocha.json
else
  $CMD $@
fi