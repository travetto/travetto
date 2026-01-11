# Backlogged Requests

## Migrate Away from Buffer/Readable
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
