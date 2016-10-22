#!/bin/sh
function test() {
  mocha --require node_modules/@encore/base/src/lib/require-ts.js --require src/test/  $@ 
}

if [[ "$1" == "all" ]]; then
  test src/test/**/*.ts
elif [[ "$1" == "bamboo" ]]; then
  test -r json src/test/**/*.ts > mocha.json
else
  test $@
fi