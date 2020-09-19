#!/bin/bash
sed -i'' -E 's/(process.stdout.columns \|\|).*;/\1 140;/' node_modules/commander/index.js

# Startup mongo
npm run service restart mongodb

TGT=related/travetto.github.io/src/app/documentation/overview/overview.component.html
echo '<div class="documentation">' > $TGT;
npx markdown-to-html --flavor gfm README.md |\
  grep -v '<p.*<img' |\
  grep -v '<sub' >> $TGT;
echo '</div>' >> $TGT
echo '<app-module-chart></app-module-chart>' >> $TGT;

pushd related/todo-app
npx trv doc -o ../travetto.github.io/src/app/guide/guide.component.html -o ./README.md
popd

pushd related/vscode-plugin
npx trv doc -o ../travetto.github.io/src/app/documentation/vscode-plugin/vscode-plugin.component.html -o ./README.md
mkdir -p ../travetto.github.io/src/assets/images/vscode-plugin
cp -r images/* ../travetto.github.io/src/assets/images/vscode-plugin
popd

npx lerna exec --no-sort --stream --no-bail --no-private --\
  trv doc -o ../../related/travetto.github.io/src/app/documentation/gen/%MOD/%MOD.component.html -o ./README.md