DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
BASEDIR=$(dirname $DIR)

cp $BASEDIR/lerna.json $BASEDIR/lerna.json.bak
cat $BASEDIR/lerna.json.bak | sed -e 's|"module/\*"|"module/*", "sample/*"|' > $BASEDIR/lerna.json
lerna clean --yes
lerna bootstrap --hoist
mv $BASEDIR/lerna.json.bak $BASEDIR/lerna.json
rm -f $BASEDIR/package-lock.json

$DIR/lerna-supplement.js $@