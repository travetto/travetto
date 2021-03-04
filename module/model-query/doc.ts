import { doc as d, mod, Section, Code, inp, lib, List, SubSection, fld, Snippet, Table } from '@travetto/doc';

import { Links } from './support/doc-support';

exports.text = d`
This module provides an enhanced query contract for ${mod.Model} implementations.  This contract has been externalized due to it being more complex than many implemenations can natively support.  In addition to the contract, this module provides support for textual query language that can be checked and parsed into the proper query structure.

${Section('Contracts')}

${SubSection(Links.Query)}
This contract provides the ability to apply the query support to return one or many items, as well as providing counts against a specific query.

${Snippet(Links.Query.title, './src/service/query.ts', /export interface/, /}/)}

${SubSection(Links.QueryCrud)}
Reinforcing the complexity provided in these contracts, the ${Links.QueryCrud} contract allows for bulk update/deletion by query.  This requires the underlying implentation to support these operations.

${Snippet(Links.QueryCrud.title, './src/service/crud.ts', /export interface/, /}/)}


${SubSection(Links.QueryFacet)}
With the complex nature of the query support, the ability to find counts by groups is a common and desirable pattern. This contract allows for faceting on a given field, with query filtering.

${Snippet(Links.QueryFacet.title, './src/service/facet.ts', /export interface/, /}/)}

${SubSection(Links.QuerySuggest)}
Additionally, this same pattern avails it self in a set of suggestion methods that allow for powering auto completion and typeahead functionalities.

${Snippet(Links.QuerySuggest.title, './src/service/suggest.ts', /export interface/, /}/)}

${Section('Implementations')}

${Table(
  ['Service', 'Query', 'QueryCrud', 'QueryFacet'],
  [mod.ModelElasticsearch, 'X', 'X', 'X'],
  [mod.ModelMongo, 'X', 'X', 'X',],
  [mod.ModelSql, 'X', 'X', 'X',],
)}

${Section('Querying')}

One of the complexities of abstracting multiple storage mechanisms, is providing a consistent query language.  The query language the module uses is a derivation of ${lib.MongoDB}'s query language, with some restrictions, additions, and caveats. Additionally, given the nature of typescript, all queries are statically typed, and will catch type errors at compile time.

${SubSection('General Fields')}
${List(
  d`${inp`field: { $eq: T }`} to determine if a field is equal to a value`,
  d`${inp`field: { $ne: T }`} to determine if a field is not equal to a value`,
  d`${inp`field: { $exists: boolean }`} to determine if a field exists or not`,
  d`${inp`field: T`} to see if the field is equal to whatever value is passed in`
)}

${SubSection('General Single Valued Fields')}
${List(
  d`${inp`field: { $in: T[] }`} to see if a record's value appears in the array provided to ${inp`$in`}`,
  d`${inp`field: { $nin: T[] }`} to see if a record's value does not appear in the array provided to ${inp`$in`}`,
)}

${SubSection('Ordered Fields')}
${List(
  d`${inp`field: { $lt: T }`} checks if value is less than`,
  d`${inp`field: { $lte: T }`} checks if value is less than or equal to`,
  d`${inp`field: { $gt: T }`} checks if value is greater than`,
  d`${inp`field: { $gte: T }`} checks if value is greater than or equal to`,
)}
${SubSection('Array Fields')}
${List(
  d`${inp`field: { $all: T[]] }`} checks to see if the records value contains everything within ${inp`$all`}`,
)}

${SubSection('String Fields')}
${List(
  d`${inp`field: { $regex: RegExp | string; }`} checks the field against the regular expression`,
)}

${SubSection('Geo Point Fields')}
${List(
  d`${inp`field: { $geoWithin: Point[] }`} determines if the value is within the bounding region of the points`,
  d`${inp`field: { $near: Point, $maxDistance: number, $unit: 'km' | 'm' | 'mi' | 'ft' }`} searches at a point, and looks out radially`,
)}

${SubSection('Groupings')}
${List(
  d`${inp`{ $and: [] }`} provides a grouping in which all sub clauses are required`,
  d`${inp`{ $or: [] }`} provides a grouping in which at least one of the sub clauses is required`,
  d`${inp`{ $not: { } }`} negates a clause`,
)}

A sample query for ${inp`User`}'s might be:

${Code('Using the query structure for specific queries', 'doc/user-query.ts')}

This would find all users who are over ${inp`35`} and that have the ${inp`contact`} field specified.

${Section('Query Language')}

In addition to the standard query interface, the module also supports querying by query language to facilitate end-user queries.  This is meant to act as an interface that is simpler to write than the default object structure.

The language itself is fairly simple, boolean logic, with parenthetical support.  The operators supported are:
${List(
  d`${inp`<`}, ${inp`<=`} - Less than, and less than or equal to`,
  d`${inp`>`}, ${inp`>=`} - Greater than, and greater than or equal to`,
  d`${inp`!=`}, ${inp`==`} - Not equal to, and equal to`,
  d`${inp`~`} - Matches regular expression, supports the ${inp`i`} flag to trigger case insensitive searches`,
  d`${inp`!`}, ${inp`not`} - Negates a clause`,
  d`${inp`in`}, ${inp`not-in`} - Supports checking if a field is in a list of literal values`,
  d`${inp`and`}, ${inp`&&`} - Intersection of clauses`,
  d`${inp`or`}, ${inp`||`} - Union of clauses`,
)}

All sub fields are dot separated for access, e.g. ${fld`user.address.city`}. A query language version of the previous query could look like:

${Code('Query language with boolean checks and exists check', 'not (age < 35) and contact != null', false, 'sql')}

A more complex query would look like:

${Code('Query language with more complex needs',
  `user.role in ['admin', 'root'] && (user.address.state == 'VA' || user.address.city == 'Springfield')`, false, 'sql')}

${SubSection('Regular Expression')}

When querying with regular expressions,patterns can be specified as ${inp`'strings'`} or as ${inp`/patterns/`}.  The latter allows for the case insensitive modifier: ${inp`/pattern/i`}.  Supporting the insensitive flag is up to the underlying model implementation.

${Section('Custom Model Query Service')}
In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for
repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the ${mod.ModelQuery} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

${Code('MongoDB Service Test Configuration', '@travetto/model-mongo/test/service.query.ts')}
`;