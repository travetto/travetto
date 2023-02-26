# Polymorphism and model operations.

The model framework supports at most one level of polylmorphism, multiple levels will be rejected by the `ModelRegistry`. 
All operations will be against the base store as defined by the model definition (whatever it inherits from). Ids cannot be
unique across types, but are unique to the base type (this is the way).  All endpoints that return entities, will be converted/
cast on return appropriately.  If requesting a specific class (create, update, delete, upsert, bulk, etc.), on that population should be affected and returned.  When using an endpoint that affects/returns multiple records (list, query, updateByQuery, deleteByQuery, etc), you can either pass a base class or a sub class depending on your needs.

With respect to interfaces:

* - Means the method supports polymorphism input (base or sub class)
@ - Means the method supports requires concrete class instances

## ModelBasicSupport
- [*] get    - Will check and cast the type properly on retrieval.  If type doesn't match, throw not found
- [*] delete - Will verify the type/id before deleting, if type doesn't match, throw not found
- [@] create - Will collide on matching ids, but requires sub type for input

## ModelCrudSupport 
- [@] update/updatePartial - Verify the types before attempting update, and throw not found if doesn't match
- [@] upsert               - If id already exists, check type, if mismatch throw exists error.
- [*] list                 - Only return models of the matching type

## ModelBulkSupport
- [@] processBulk   - Enforce the bulk operation aganist all type.  
  - create/upsert - Same as `upsert` in `ModelCrudSupport`
  - delete        - Same as `delete` in `ModelBasicSupport`
  - update        - Same as `update` in `ModelCrudSupport`

## ModelIndexedSupport
- [*] getByIndex     - Same as `get` in `ModelBasicSupport`
- [*] deleteByIndex  - Same as `delete` in `ModelBasicSupport`

## ModelQuerySupport
- [*] query          - If passed a subtype, limit by the specific type, otherwise return matches against the base type
- [*] queryOne       - Same as `query`
- [*] queryCount     - Same as `query`  

## ModelQueryFacetSupport
- [*] suggest        - Same as `query`
- [*] suggestValues  - Same as `query`
- [*] facet          - Same as `query`

## ModelQueryCrudSupport
- [*] updateByQuery - Query should be limited to enforcing specific type
- [*] delteByQuery  - Same as `updateByQuery`