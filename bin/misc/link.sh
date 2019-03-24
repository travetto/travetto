#!/bin/bash

if [ -L "$0" ]; then
  SCRIPT=`readlink -f "$0"`
  DIR=`dirname $SCRIPT`
else
  DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
fi

BIN=`dirname $DIR`
ROOT=`dirname $BIN`
MODULE="$1"
CURR=`pwd`
SOURCE="$ROOT/module/$MODULE"

if [ -z "$MODULE" ]; then
  echo 'Please specify which module you want to link'
  exit 1
elif [ ! -d "$SOURCE" ]; then
  echo 'Please specify a valid target module, '$SOURCE' does not exist'
  exit 1
fi

while [ ! -f "${CURR}/package.json" ] && [[ "$CURR" =~ "travetto/module" ]]; do
  CURR=`dirname $CURR`
done

BASE="${CURR//"${ROOT}/module/"}"

TARGET="$CURR/node_modules/@travetto/$MODULE"

if [ -f "${CURR}/package.json" ] && [[ "$CURR" =~ "travetto/module" ]]; then
  ln -sf $SOURCE $TARGET
  echo $BASE/node_modules/@travetto/$MODULE now points to $ROOT/module/$MODULE 
else
  echo 'Script must be run from a travetto module directory'
  exit 1
fi

