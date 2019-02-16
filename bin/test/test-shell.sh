#!/bin/bash

if [[ -z "$1" ]]; then
  time (ls  module | xargs --max-procs=6 --max-args=1 $0)
else
  BIN=$(dirname `dirname $0`)
  ROOT=$(dirname $BIN)

  pushd $ROOT/module/$1

  npx travetto test -f event -c 1

  popd
fi