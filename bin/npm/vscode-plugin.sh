ROOT=`pwd`
ROOT_NM=${ROOT}/node_modules
MOD_ROOT=${ROOT}/module
VSCODE_ROOT=${ROOT}/related/vscode-plugin
VSCODE_NM=${VSCODE_ROOT}/node_modules

# Configure vscode plugin
cd $VSCODE_ROOT

mkdir -p ${VSCODE_NM}/@types
mkdir -p ${VSCODE_NM}/.bin

# Handle boot
rm -rf ${VSCODE_NM}/@travetto/boot
mkdir -p ${VSCODE_NM}/@travetto/boot
cp -r ${MOD_ROOT}/boot/src ${VSCODE_NM}/@travetto/boot/src
cp ${MOD_ROOT}/boot/package.json ${VSCODE_NM}/@travetto/boot/package.json

for x in source-map-support tslib typescript buffer-from; do 
  cp -r $ROOT_NM/$x ${VSCODE_NM}
done
for x in source-map-support node; do 
  cp -r $ROOT_NM/@types/$x ${VSCODE_NM}/@types
done
for x in tsc; do 
  cp -r $ROOT_NM/.bin/$x ${VSCODE_NM}/.bin
done