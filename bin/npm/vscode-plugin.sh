ROOT=`pwd`
MOD_ROOT=${ROOT}/module
VSCODE_ROOT=${ROOT}/related/vscode-plugin
VSCODE_NM=${VSCODE_ROOT}/node_modules

rm -rf $VSCODE_NM

# Configure vscode plugin
cd $VSCODE_ROOT
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
