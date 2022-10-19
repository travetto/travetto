Module Structure
-----------------
## App Config
* (root)
  * doc/
  * src/
  * resources/
  * support/
  * test/
    * resources/
  * doc.ts
  * index.ts - Root index for loading

## Test
* test/
  * resources/

## Library (node_modules/@travetto/{x})
* bin/ - Pure JS files for execution
* support/ -
  - bin/ support for main/cli operations
  - phase.* Phase support 
  - transform.* AST transformer support
  - main.* Main entry points
  - cli.* CLI entry points

App Running
-----------------------------
## Auto-Scanning
* (libraries)/src - Load all library source
* (libraries)/support - Loading all transformers
* (root)/index - Main app logic
* (root)/src - Main app logic

## Config
* (root)/resources/*.yml

Test Running
-----------------------------
## Auto-Scanning
* (libraries)/src - Load all library source
* (libraries)/support - Loading all transformers
* (root)/src - Main app logic
* (root)/support - Loading all transformers

## Manual loading
* (root)/test - for individual execution

## Config
* (root)/resources/*.yml
* (root)/test/resources/*.yml