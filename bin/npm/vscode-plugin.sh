MOD_ROOT=`pwd`/module
ROOT=`pwd`
VSCODE_ROOT=`pwd`/related/vscode-plugin
VSCODE_NM=${VSCODE_ROOT}/node_modules

# Configure vscode plugin
cd $VSCODE_ROOT
rm -rf node_modules/
npm  i

# Handle boot
rm -rf ${VSCODE_NM}/@travetto/boot
mkdir -p ${VSCODE_NM}/@travetto/boot
cp -r ${MOD_ROOT}/boot/src ${VSCODE_NM}/@travetto/boot/src
cp ${MOD_ROOT}/boot/package.json ${VSCODE_NM}/@travetto/boot/package.json

# Link in modules
for el in 'config' 'doc' 'compiler' 'registry' 'base' 'test' 'app'; do
  ln -sf ${MOD_ROOT}/${el} ${VSCODE_NM}/@travetto/${el}
done

# Setup cli
ln -sf ${MOD_ROOT}/cli/bin/travetto.js  ${VSCODE_NM}/.bin/trv
