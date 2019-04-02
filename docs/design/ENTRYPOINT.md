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
i = init, r = run, a = await

* base/bin (Used as a bootstrap, when running script run as app)
  ------------------------------------------------------
  [i  ] ./bootstrap.js           [ lib.js - bootstrap ]  
  [ira] ./travetto-cli-boot.js   [ lib.js - runScript ]

* compiler/bin (Run app to establish all transformers)
  ------------------------------------------------------
  [ira] ./travetto-cli-compile.js  

* di/bin (Run app selected, collect app data)
  ------------------------------------------------------
  [ira] ./find-apps.js           [ lib.js - computeApps, bootstrap - compiler ]
  [ira] ./travetto-cli-run.js    [ lib.js - runApp ] 
  [ira] ./travetto-plugin-run.js [ lib.js - runApp ]

* email-template/bin (Run app for email activity)
  ------------------------------------------------------
  [ira] ./travetto-cli-email-template.js  

* generator-app/app (Used as a bootstrap)
  ------------------------------------------------------
  [i  ] ./index.js                        

* model-elasticsearch/bin (Run app to collect data)
  ------------------------------------------------------
  [ira] ./travetto-cli-es_schema.js [ lib.js - getSchemas ] 

* rest-aws-lambda/bin (Run app to collect data)
  ------------------------------------------------------
  [ira] ./travetto-cli-rest-aws-lambda_build-sam.js  

* swagger/bin  (Run app to collect data)
  ------------------------------------------------------
  [ira] ./travetto-cli-swagger-client.js [ lib.js ] 

* test/bin (Initialize compiler, not loading transformers)
  ------------------------------------------------------
  [i  ] ./test-worker.js          [ lib.js - worker ]
  [i  ] ./travetto-cli-test.js    [ self, lib.js - runTests ]
  [i  ] ./travetto-plugin-test.js [ lib.js - runTests ]