Entry Points
------------------

Within the @travetto framework, there are three main entry points into the system.  

- CLI actions
- PLUGIN adapters
- Direct invocation

##Commonalities

Because of how the framework is developed, and even in general, symlinks cause Node to behave poorly when dealing with forked instances.  The pattern we have established, is to preserve the current directory on fork, as an environment variable.  Then, the forked script will rely upon that variable to know of it's expected location.  

Additionally, because of the symlink behavior, and that the issue only applies to the entry point, we try to offload as much logic as possible to a secondary library, usually a `lib.js`.  Once this library is loaded using the appropriate file path, everything continues as usual.


##CLI Actions

Within the framework, we expose CLI actions through the various modules.  These actions allow for simple and organized access to common tasks. Given that these are directly invoked, there is not special requirements.  

##Direct Invocation

This is assumed that the caller knows what they are doing.  Usually these scripts support being forked in a symlinked environment, but there are some exceptions (`@travetto/base/bin/bootstrap`).

##Plugin Adapters

These are scripts exposed for the plugin to execute, and to honor the contract the vscode plugin expects for execution.  These are 100% forked and require the environment variable to be set for proper invocation.

## Inventory 
t = typescript, i = init, r = run, a = await

* boot/bin (Used as a bootstrap, when running script run as app)
  ------------------------------------------------------
  [t   ] ./init.js                

* cli/bin (Run cli)
  ------------------------------------------------------
  [t   ] ./travetto.js

* compiler/bin (Run app to establish all transformers)
  ------------------------------------------------------
  [    ] ./cli-compile.ts  
  [tira] ./plugin-compile.js

* di/bin (Run app selected, collect app data)
  ------------------------------------------------------
  [tira] ./plugin-find-apps.js           [ lib.js - computeApps, bootstrap - compiler ]
  [ ira] ./cli-run.ts    [ lib.js - runApp ] 
  [tira] ./plugin-run.js [ lib.js - runApp ]

* email-template/bin (Run app for email activity)
  ------------------------------------------------------
  [ ira] ./cli-email-template.ts  

* generator-app/app (Used as a bootstrap)
  ------------------------------------------------------
  [t   ] ./index.js                        

* model-elasticsearch/bin (Run app to collect data)
  ------------------------------------------------------
  [ ira] ./cli-es_schema.ts [ lib.js - getSchemas ] 

* rest-aws-lambda/bin (Run app to collect data)
  ------------------------------------------------------
  [ ira] ./cli-rest-aws-lambda_build-sam.ts  

* swagger/bin  (Run app to collect data)
  ------------------------------------------------------
  [ ira] ./cli-swagger-client.ts [ lib.js ] 

* test/bin (Initialize compiler, not loading transformers)
  ------------------------------------------------------
  [ ira] ./plugin-child-worker.js          [ lib.js - worker ]
  [ ira] ./cli-test.ts    [ self, lib.js - runTests ]
  [tira] ./plugin-test.js [ lib.js - runTests ]