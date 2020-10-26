#!/bin/sh
echo -n "Lerna clean ... "
npx lerna clean --yes
echo "done."
echo -n "Lerna bootstrap ... "
npx lerna bootstrap --hoist
echo "done."
rm -f package-lock.json