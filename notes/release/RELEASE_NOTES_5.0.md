# Travetto 5.0 Release Notes

> Release 5.0 - 2024-8-26

## Major/Breaking Changes
### NodeJS Alignment
* Shifted over to core nodejs logic where applicable, removed corresponding functionality

### Asset 
* Removed, cannibalized by model changes

### Yaml 
* Removed in favor of standard yaml install

### Base
* Renamed to Runtime
* Non-core functionality moved out
* Focused on being a layer between os and travetto
* Defer to node implementations where possible (object util, stream util)
* Moved data util to schema
* Now owns all the core transformers, manifest doesnt
   * Path should now be used as a standard import (swapped out at build time)
* Reworked how we store file ids, and access them
   * No longer depending on manifest for registering classes
* ResourceLoader is gone, only File Loader

### Compiler
* Fixed bug that killed all userland processes

### VSCode / Tooling Overhaul
* Fewer open calls to travetto cli
* Defer testing/email to run only when needed

### Pack
* Exposed ability to externalize npm modules easily

### Test
* Provide ability to tag tests, for easy exclusion/inclusion
* Shifted from regexes to globs (using node's standard glob support)
* Shuffle suites on execution (speedup and uncovers new issues)
* Fixed promise detection to properly find unresolved promises

### Model + Stream
* Model service shifted support form streams to blobs
* Removed most of the needs for the asset module
* Cleaned up data flow to ensure minimal data being loaded into memory where possible
* Aligned entire platform around blob

### Asset-Upload
* Moved to rest-upload
* Standardized on blob/file for upload
* Centralized logic for hashing/file detection to where we know we have a file on disk

### Image
* Pulled in sharp for native-node support, avoiding the external operations
