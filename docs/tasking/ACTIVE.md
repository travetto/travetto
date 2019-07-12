In-Progress
=============

Compiler
----------------------
- [ ] Support type checking in transformers
  - [ ] Convert schema/rest/swagger/model/application to use resolved type information
  - [ ] Investigate auto creating schemas from interfaces for simple one offs

SQL
----------------------
- [?] Building out SQL model support
  - [X] Add tests to base for 'replace' mode of deepAssign
  - [X] Support mysql/postgres as first pass
  - [X] Figure out paradigm for ownership of namespacing
  - [?] Look for query optimization opportunities
  - [X] Basic polymorphism support
  - [X] Sorting/paging
  - [X] Handle schema changes (columns added removed)
 
Tooling
-----------------------
- [ ] Yeoman Generator Full Rewrite
  - [ ] Provide better mechanism for getting proper version
  - [ ] Handle cross dependencies
  - [ ] Provide better inputs for controlling name of packages/folders
  - [ ] Move tests to devDependencies

Tests
--------------
- [?] Better unit tests