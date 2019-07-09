# Design for SQL Model Service integration

The primary issue here is the ability to be able to treat SQL databases as document stores. This includes:
* Nested documents
* Nested arrays 
* Ability to filter by properties in children
* Requiring querying start at root of document
* Ability to partial update documents
* Performance

The two primary modes for this could be:
1. Use underlying JSON data types in relational databases
  * MySQL has JSON_EXTRACT/JSON_SET
  * PostgreSQL has a large st of JSON operations
  * SQL Server has support
  * ...
2. Structure the JSON data into tables
  * Requires solving the challenge of how to preserve object structure
  * Fetching data must happen in two phases:
    - Query data to retrieve primary objects
    - Query data to access sub-objects (can be a lot of tables, can be either a big query or a lot of small queries)

While the first approach is simpler in it's immediate implementation for a single DB, it will be a custom implementation for
every database vendor.  Additionally, the performance of the first approach is significantly degraded as compared to standard
columns and queries.

As stated, the second approach has it's own warts, in that querying is now a more complicated affair which will require some
complexity, but should be standard behavior across all vendors.

## Referential Schema

Assuming a schema:

```typescript
class Person {
  name: string;
  addresses: Address[];
  children: string[];
}

class Address {
  street1: string;
  street2?: string;
  city: City;
  postalCode: string;
}

class City {
  name: string;
  state: string;
}
```

## Creating Tables
Given the schema, what would creating tables look like?

The code would first create the `Person` table without any of the foreign-keyed objects.  Then it would find all the of the foreign-keyed objects
and repeat the process.  Though, as the table generation recurses into the structure, a few things must happen:
1. Sub-tables must be namespaced to the root object, the should not be directly used, but only transitively
2. Sub-tables must have foreign-keys to the parents to identify the relationship
3. Sub-tables must identify their path relative to the root object.  This implies:
  - We will need to generate a unique key for each value, that points back to the root object
    * This is currently a SHA-2 hash of the object path (e.g. `$root.addresses[0]` or `$root.addresses[0].city`)
    * This will allow for updates to specific sections of the object without the need for full rewrites
  - We will need to create a unique constraint on the parent/child path to ensure we aren't storing two places in the same object twice
4. Simple relationships (E.g. `string[]`) will need to be stored as separate tables as well, to allow for simple lookup
  - Plain objects aren't currently supported, but should generally be discouraged due to their lack of validation


## Dropping Tables
This process is very similar to creation, minus the required knowledge of table structure.  It will navigate all of the foreign-keyed objects
and delete them recursively, honoring the constraints first before finally deleting the root table.

## INSERT
On inserting, the following steps need to occur:
1. A transaction is started
2. Root object must be persisted against schema
3. All foreign-keyed objects must be recursively created and persisted, batching where possible
  - The PATH_ID must be generated as the traversal occurs to establish the JSON structure  

## DELETE
On deleting of an entity, the pattern is similar to dropping tables, in that all the relationships need to be honored, and deleted in a single
transaction, preferably in a single query.

## UPDATE
On update, we have a much more complex problem, as we now need to deal with the inner workings of the document.  For full updates we can
1. Start a transaction
2. Delete the object
3. Insert the new object

For partial updates we, will now need to deal with the intricacies of the nested schema. For each change we will need to:
1. Start a transaction
2. Start at the sub-root of the change, as provided by the update query
3. Delete everything under that sub-root
4. Insert the new structure into the sub-root

Partial changes at the same level should be batched for performance

## SELECT
For the final act of selection, this brings out the hardest challenges yet.  How to query and how to construct objects efficiently. 
The primary issue, as I'm sure it is for all ORMs, is one of abstraction.  The goal for the Model services is to be an opaque API that
allows for comprehensive interoperability, and a clear set of operations.  This means, that we have some fundamental disconnects with 
SQL databases.  Primarily one around selection in terms of tuples vs documents.  To query the full set of inner joins needed to honor
a deep structure we have two options:

1. Single query with all tables inner_joined
  - This could result in a large set of data being returned
  - This would require splitting up large tuples into various sub objects and aggregating them
2. Multiple queries per foreign-keyed object
  - This would result in, at a minimum, one query per foreign-keyed object
  - Querying by ids at each subsequent level (which could run into problems with limits)

Option one sounds simpler in terms of querying time, but would force a lot of duplicate data to be returned, which could put a heavy
load on the database.

Second option will be heavier in terms of query time, but lighter in terms of returned data.  Also, the shallower (which is more common) the data model, the less this is an issue for either of them.

In addition to the retrieval option, we still have querying issues.  The primary here being that we need to alias every table appropriately and every field appropriately.  This will allow us to convert the nested query structure into a linear format.  