#!/bin/bash
TAB="$(printf '\t')"
rm -rf mono/ TMP/

mkdir mono
git init mono

for x in `ls | grep -v mono | grep -v TMP | grep -v merge.sh`; do 

  REPO=`pwd`/TMP
  rm -rf $REPO
  git clone ./$x $REPO

  pushd $REPO
    git tag -d `git tag | grep -E '.'` > /dev/null
    git filter-branch --index-filter 'git ls-files -s | sed "s|\t\"*|\tmodule/'$x'/|" |
   GIT_INDEX_FILE=$GIT_INDEX_FILE.new \
   git update-index --index-info &&
   mv "$GIT_INDEX_FILE.new" "$GIT_INDEX_FILE"' HEAD
    git commit . -m 'Rewrite history for module/'$x
  popd

  pushd mono
    git pull --no-tags $REPO master --no-commit --allow-unrelated-histories
    git commit -m 'Merged in module/'$x
  popd;

  rm -rf TMP/ 
done