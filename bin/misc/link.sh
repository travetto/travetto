#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BASENAME="$( basename "${BASH_SOURCE[0]}" )"

if [ -L "$DIR/$BASENAME" ]; then
  SCRIPT=`readlink -f "$DIR/$BASENAME" 2> /dev/null || readlink "$DIR/$BASENAME"`
  DIR=`dirname $SCRIPT`
fi

BIN=`dirname $DIR`
ROOT=`dirname $BIN`
ACTION="$1"
MODULE="$2"
CURR=`pwd`

if [[ -z "$MODULE" ]] && [[ "$ACTION" != 'add' ]] && [[ "$ACTION" != 'remove' ]]; then
  MODULE="$1"
  ACTION="add"
fi

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

BASE="${CURR//${ROOT}\/module\/}"

TARGET="$CURR/node_modules/@travetto/$MODULE"

if [ -f "${CURR}/package.json" ]; then
  if [ "$ACTION" == "add" ]; then 
    ln -sf "$SOURCE" "$TARGET"
    echo "$BASE is linking @travetto/$MODULE to ../$MODULE" 
  else
    rm $TARGET 
    echo "$BASE is unlinking @travetto/$MODULE" 
  fi
else
  echo 'Script must be run from a travetto module directory'
  exit 1
fi

