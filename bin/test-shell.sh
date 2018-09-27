#!/bin/bash

if [[ -z "$1" ]]; then
  time (ls  module | xargs --max-procs=6 --max-args=1 $0)
else
  BIN=$(dirname $0)
  ROOT=$(dirname $BIN)

  pushd $ROOT/module/$1

  NODE_PRESERVE_SYMLINKS=1 travetto test -f event -c 1

  popd
fi