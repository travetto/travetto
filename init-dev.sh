export NODE_PRESERVE_SYMLINKS=1

ROOT=`dirname ${BASH_SOURCE[@]}`
ROOT=`realpath $ROOT`

lerna clean --yes
lerna bootstrap --hoist

function resolve_deps() {
  OUT=""
  for dep in `jq -r '.dependencies,.devDependencies | to_entries | .[].key' $ROOT/module/$1/package.json 2>/dev/null | grep travetto | awk -F '/' '{ print $2 }' | grep .`; do
    SUBS=`resolve_deps $dep`
    OUT="$OUT~$dep~$SUBS"
  done
  echo $OUT
}

function mk_link() {
  if [[ ! -e "$2" ]]; then
    ln -s $1 $2
  fi 
}

function init() {
  NAME=`echo $1 | awk -F '/' '{ print $NF }'`
  DEPS=`resolve_deps $NAME | tr '~' '\n' | sort -u`

  mkdir -p $ROOT/module/$NAME/node_modules/@travetto

  for sub in typescript tslib; do
    mk_link $ROOT/node_modules/$sub $ROOT/module/$NAME/node_modules/$sub
  done  

  for DEP in `echo "$DEPS"`; do
    mk_link $ROOT/module/$DEP $ROOT/module/$NAME/node_modules/@travetto/$DEP
  done

  mk_link $ROOT/module/$NAME $ROOT/module/$NAME/node_modules/@travetto/$NAME

  TEST_DEPS=`resolve_deps test | tr '~' '\n' | sort -u`
  mk_link $ROOT/module/test $ROOT/module/$NAME/node_modules/@travetto/test
  for DEP in `echo "$TEST_DEPS"`; do
    if [ ! "$NAME" == "$DEP" ]; then
      mk_link $ROOT/module/$DEP $ROOT/module/$NAME/node_modules/@travetto/$DEP
    fi
  done
}

for x in $ROOT/module/*; do
  init $x
done