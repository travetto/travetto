# Reload On Change

Replacing inline is proving to be extremely complicated:
* Nested class changes
  * Inheritance
  * field/sub-field changes
    * Inheritance of these types
* Files needing to be "reloaded" that haven't changed
  * Lots of "Mocking"
* ESM doesn't like this at all, makes it hard
* Proxy-related issues
  * Proxying breaks some contracts, and can make some testing invalid
* ESM 

## What Needs To Change
* Need a way to restart any application when running in dynamic mode
   * Already support, just need make it the standard mode
   * Compiler is unchanged
   * Verify debugging isn't broken (connection should remain, or restart)
* Remove all proxying
* Remove all concept of "update/delete/create" from registries
   * Reload is now the goal
* Test watcher
   * Will not listen to restarts      
   * Will still need to listen for method changes to dispatch tests
      * Inheritance is still a valid need here
      * Can be isolated to tests
* Model-sql, Model-elasticsearch
   * Will need to evaluate on startup the proposed schema vs the current
   * Changes will be between model schema and db schema
* Could default to ESM only
  * Allows removing of all CommonJS code
    * Compiler Bootstrap
    * Compiler Host
    * ESlint
    * Manifest init
    * Pack, can target a single runtime

