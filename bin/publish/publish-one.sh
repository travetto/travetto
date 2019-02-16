#!/bin/bash
SCRIPTS=`dirname $0`
BASE=`dirname $(dirname $SCRIPTS)`

MOD=$1
pushd $BASE/module/$MOD

  if [[ -n "$2" ]]; then 
    npm version $2
  fi

  V=`cat package.json | jq -r .version`;
  TAG=@travetto/$MOD@$V

  #Tag release
  git tag $TAG

  GIT_AUTHOR_NAME="$(git show $TAG --format=%aN -s)"
  GIT_AUTHOR_EMAIL="$(git show $TAG --format=%aE -s)"
  GIT_AUTHOR_DATE="$(git show $TAG --format=%aD -s)"
  GIT_COMMITTER_NAME="$(git show $TAG --format=%cN -s)"
  GIT_COMMITTER_EMAIL="$(git show $TAG --format=%cE -s)"
  GIT_COMMITTER_DATE="$(git show $TAG --format=%cD -s)"

  #Update Tag
  git tag -a -m $TAG -f $TAG $TAG
  git push --tags --force

  #Publish
  npm publish

popd