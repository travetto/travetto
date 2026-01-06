# Backlogged Requests

## Use tsconfig to overwrite `node:path` vs transformer
* Remove the transformer
* Leverage tsconfig's paths feature to control where 'node:path' points to
* If not possible, leverage 'trv:path' as a means to isolate

## Use Proxy to replace use of `ts`. 
* Maybe use tsconfig paths to map `trv:ts` to proxy that defers loading of typescript
* Add explicit initialization in compiler

## Transformer simplification
* Drop decorators for explicit registration
* This is the last of the non-compatible syntax for loading with type erasure

## Native Typescript Execution
Rework compiler setup to no longer need the pre-compilation process and leverage type stripping, now that we are fully ESM
* Decorators will need to be rethought if this is the goal

## Migrate Away from Buffer
- UInt8Array, and ArrayBuffer exist as cross-platform components that should suffice 
- This will help cleanup general noise around node specific implementations
- Should we do the same for Readable Streams?

## Model Transaction Support
* Mongo Supports Transactions
* Dynamodb supports transactions
* Firestore Supports transactions
* Expand some form of transactionality as a primitive for use within service methods (separate from sql transactions)
* Might require some rework of the sql naming conventions
* Should be user controlled, and will not work cross model stores

## Refine Development Restart
* Filter out files that should probably not trigger a full restart (maybe)

## Model
- [?] Look for SQL query optimization opportunities

## New Text Search Module, build upon Model
- [ ] Elasticsearch Support
  - [ ] Extended query language

## Documentation
- [ ] How to develop, markdown for how to contribute

## Decorators
* ES Decorators
  - Wait for parameter decorators
  - Wait for function decorators
      - Injectable Factories
      - One-off routes
