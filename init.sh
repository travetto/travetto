export NODE_PRESERVE_SYMLINKS=1
cp lerna.json lerna.json.bak
cat lerna.json.bak | sed -e 's|"module/\*"|"module/*", "sample/*"|' > lerna.json
lerna clean --yes
lerna bootstrap --hoist
mv lerna.json.bak lerna.json
rm -f package-lock.json
./lerna-supplement.js $@