Backlogged Requests
===============   
Model
----------------------
- [?] Look for SQL query optimization opportunities

New Text Search Module, build upon Model
-----------------------
- [ ] Elasticsearch Support
  - [ ] Extended query language

Documentation
-----------------------
- [ ] How to develop, markdown for how to contribute

Decorators
----------------------
* ES Decorators
  - Wait for parameter decorators
  - Wait for function decorators
      - Injectable Factories
      - One-off routes

Transactions
----------------------
* Mongo Supports Transactions
* Dynamodb supports transactions
* Firestore Supports transactions
* Expand some form of transactionality as a primitive for use within service methods (separate from sql transactions)
* Might require some rework of the sql naming conventions
* Should be user controlled, and will not work cross model stores