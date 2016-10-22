#!/bin/sh
function test() {
  mocha --require src/test/ --ui with-context $@ 
}

if [[ "$1" == "all" ]]; then
  test src/test/**/*.ts
elif [[ "$1" == "bamboo" ]]; then
  test -r json src/test/**/*.ts > mocha.json
else
  test $@
fi