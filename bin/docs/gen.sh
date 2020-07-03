#!/bin/bash
pushd module/model
../../bin/misc/link.sh rest
../../bin/misc/link.sh config
popd
pushd module/schema
../../bin/misc/link.sh rest
../../bin/misc/link.sh config
popd

npx lerna exec --no-sort --stream --no-bail --no-private --\
  trv doc  -f html -o ../../related/travetto.github.io/src/app/documentation/gen/%MOD/%MOD.component.html

npx lerna exec --no-sort --stream --no-bail --no-private --\
  trv doc  -f md -o ./README.md

pushd related/todo-app
npx trv doc -f html -o ../travetto.github.io/src/app/guide/guide.component.html
npx trv doc -f md -o ./README.md
popd

pushd related/vscode-plugin
../../bin/misc/link.sh app
popd

pushd related/vscode-plugin
npx trv doc -f html -o ../travetto.github.io/src/app/documentation/vscode-plugin/vscode-plugin.component.html
npx trv doc -f md -o ./README.md
mkdir -p ../travetto.github.io/src/assets/images/vscode-plugin
cp -r images/* ../travetto.github.io/src/assets/images/vscode-plugin
popd