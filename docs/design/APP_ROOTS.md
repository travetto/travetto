Module Structure
-----------------
## App Config
* (root)
  * src/
  * resources/

* (sub-app)
  * src/  
  * resources/
  
## Test
* test/
  * resources/

## Library (node_modules/@travetto/{x})
* bin/  - CLI Support
* support/ - Phase support as well as AST transformer support
* index.ts - Root index for loading

App Running
-----------------------------
## Auto-Scanning
* (libraries)/src - Load all library source
* (libraries)/support - Loading all transformers
* (root)/index - Main app logic
* (root)/src - Main app logic
* (sub-app)/src - Sub app logic

## Config
* (root)/resources/*.yml
* (sub-app)/resources/*.yml

Test Running
-----------------------------
## Auto-Scanning
* (libraries)/src - Load all library source
* (libraries)/support - Loading all transformers
* (root)/src - Main app logic

## Manual loading
* (root)/test - for individual execution

## Config
* (root)/resources/*.yml
* (root)/test/resources/*.yml
