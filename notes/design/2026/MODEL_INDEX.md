# Model Index Overhaul

## What are Indices
What is an index? A parallel lookup to a Model that is updated/maintained as data is written and deleted.  Indices have a write-overhead that pans out in read performance amortization.  Ideally this allows us to speed up reads, at the expense of additional write overhead.  Additionally, in certain databases, the only way to find data is by self-indexing, and so indexing becomes a requirement for non-trivial access.

## Primary Types (Active, New)
* Unique       
  - Allows a single entry based on the fields selected. 
  - DB will reject duplicates
  - Can be helpful with high volume operations, or "double" submissions of the same data.
  - Operations: [update, get, upsert, updatePartial, delete]  
* Unsorted     
  - A composition of some defined keys (similar to unique), without a sortable field.  
  - Generally useful for scoped data, that does not need searching.  
  - Also useful as a unique index, that cannot be enforced (some db's don't support)
  - Operations: [update, get, upsert, updatePartial, delete, list]
* Sort
  - Same as an Unsorted key, and then a sortable field, and a direction.
  - Searching, listing, paginating are the primary use cases
  - Operations: [list, listPage]

## Secondary Types (Passive, Current model, ModelQuery indices)
* Unique       
  - Allows a single entry based on the fields selected. 
  - DB will reject duplicates
  - Can be helpful with high volume operations, or "double" submissions of the same data.
  - Kicks in when making ModelQuery calls
  - Operations: [none]  
* Complex (Mongo/SQL)
  - A series of fields, and directions.
  - This is generally used to help facilitate search performance.
  - Kicks in when making ModelQuery calls
* Geo-spatial (Mongo)
  - Primarily setup to support Geometric searches
  - Current consumer is Mongo
  - May shift out to be Mongo only?
  - Kicks in when making ModelQuery calls


## ModelIndexedSupport history
The model indexed support was introduced years ago, to handle access patterns for DynamoDB, Redis, Firestore (and Memory) Model Services.  These providers do not support rich query syntax, but the need still existed to: find, list, update, delete on more than just the unique identifier.

At this point, the framework changed to support passive indices as a means to fill this gap.  The indices are checked at runtime, when used in an active form, but can easily result in surprises at run-time, if there are any mismatches.

## Proposal
The driving force here, is that the passive indices work today, but are ergonomically broken when using in an active form.  The main draw back of using a passive index, in an active form, is how its invoked, and the lack of type-safety the user receives when invoking.  The declaration ergonomics also leave a lot to be desired, as they syntax is clunky, and has choices that do not clearly represent the scenarios listed above.

All this is to say that the "ModelIndexedSupport" flow feels like a tack-on, and it was.  What needs to change, is that the active index flow needs type-safe, and first-class support for common use cases.  The Passive flow can remain as is, but the active needs to be created, and updated in a way to help common access patterns.

### Next Steps
So, what are the next steps:

1. Create the Active Index constructs for the scenarios listed above
2. Figure out if we need to rename the passive indices
  a. QueryIndex vs Index (Makes sense)
3. Determine if we want to store the passive/active indices in the same bucket on the Model, or have two clearly defined buckets that are in parallel
4. Consider if ModelIndexed is complex enough to pull out to it's own module? 
...
98. Rewrite test suite, and support ability for differences of various databases in how they handle indices
99. Rewrite documentation for indexed
