export NODE_PRESERVE_SYMLINKS=1
lerna clean --yes
lerna bootstrap --hoist
rm -f package-lock.json
./lerna-supplement.js $@