#!/bin/bash

function link() {
  pushd $1
  for MOD in ${@:2}; do 
    ../../bin/misc/link.sh $MOD; 
  done
  popd
}

link module/auth-rest      app
link module/auth-passport  app
link module/model          rest app config
link module/schema         rest app config
link module/openapi        app
link module/rest           app
link module/rest-fastify   app
link module/rest-koa       app
link module/rest-express   app
link module/cache          schema model
link related/vscode-plugin cli  config boot doc compiler registry base test app

ln -sf `pwd`/module/cli/bin/travetto.js related/vscode-plugin/node_modules/.bin/trv