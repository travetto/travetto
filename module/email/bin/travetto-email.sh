#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

PARENT_DIR=$(dirname "$2")
pushd "$PARENT_DIR" 1>&2 2> /dev/null
TARGET="$(pwd)"/"$(basename "$2")"
popd 1>&2 2> /dev/null

pushd $DIR 1>&2 2> /dev/null
if [[ ! -e 'node_modules' ]]; then
    npm i
fi

STAND_ALONE=1 npm run $1 $TARGET

popd 1>&2 2> /dev/null