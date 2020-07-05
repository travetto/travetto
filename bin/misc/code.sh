#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BASENAME="$( basename "${BASH_SOURCE[0]}" )"

if [ -L "$DIR/$BASENAME" ]; then
  SCRIPT=`readlink -f "$DIR/$BASENAME" 2> /dev/null || readlink "$DIR/$BASENAME"`
  DIR=`dirname $SCRIPT`
fi

BIN=`dirname $DIR`
ROOT=`dirname $BIN`
MODULE="$1"
CURR=`pwd`

SOURCE="$ROOT/module/$MODULE"

if [ -z "$MODULE" ]; then
  echo 'Please specify which module you want to open'
  exit 1
elif [ ! -d "$SOURCE" ]; then
  echo 'Please specify a valid target module, '$SOURCE' does not exist'
  exit 1
fi

cd $SOURCE
code .