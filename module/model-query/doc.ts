import { d, mod, lib } from '@travetto/doc';

import { Links } from './support/doc.support';

export const text = d`
${d.Header()}

This module provides an enhanced query contract for ${mod.Model} implementations.  This contract has been externalized due to it being more complex than many implementations can natively support.  In addition to the contract, this module provides support for textual query language that can be checked and parsed into the proper query structure.

${d.Section('Contracts')}

${d.SubSection(Links.Query)}
This contract provides the ability to apply the query support to return one or many items, as well as providing counts against a specific query.

${d.Snippet(Links.Query.title, './src/service/query.ts', /export interface/, /^}/)}

${d.SubSection(Links.QueryCrud)}
Reinforcing the complexity provided in these contracts, the ${Links.QueryCrud} contract allows for bulk update/deletion by query.  This requires the underlying implementation to support these operations.

${d.Snippet(Links.QueryCrud.title, './src/service/crud.ts', /export interface/, /^}/)}


${d.SubSection(Links.QueryFacet)}
With the complex nature of the query support, the ability to find counts by groups is a common and desirable pattern. This contract allows for faceting on a given field, with query filtering.

${d.Snippet(Links.QueryFacet.title, './src/service/facet.ts', /export interface/, /^}/)}

${d.SubSection(Links.QuerySuggest)}
Additionally, this same pattern avails it self in a set of suggestion methods that allow for powering auto completion and type-ahead functionalities.

${d.Snippet(Links.QuerySuggest.title, './src/service/suggest.ts', /export interface/, /^}/)}

${d.Section('Implementations')}

${d.Table(
  ['Service', 'Query', 'QueryCrud', 'QueryFacet'],
  [mod.ModelElasticsearch, 'X', 'X', 'X'],
  [mod.ModelMongo, 'X', 'X', 'X',],
  [mod.ModelSql, 'X', 'X', 'X',],
)}

${d.Section('Querying')}

One of the complexities of abstracting multiple storage mechanisms, is providing a consistent query language.  The query language the module uses is a derivation of ${lib.MongoDB}'s query language, with some restrictions, additions, and caveats. Additionally, given the nature of typescript, all queries are statically typed, and will catch type errors at compile time.

${d.SubSection('General Fields')}
${d.List(
  d`${d.Input('field: { $eq: T }')} to determine if a field is equal to a value`,
  d`${d.Input('field: { $ne: T }')} to determine if a field is not equal to a value`,
  d`${d.Input('field: { $exists: boolean }')} to determine if a field exists or not`,
  d`${d.Input('field: T')} to see if the field is equal to whatever value is passed in`
)}

${d.SubSection('General Single Valued Fields')}
${d.List(
  d`${d.Input('field: { $in: T[] }')} to see if a record's value appears in the array provided to ${d.Input('$in')}`,
  d`${d.Input('field: { $nin: T[] }')} to see if a record's value does not appear in the array provided to ${d.Input('$in')}`,
)}

${d.SubSection('Ordered Numeric Fields')}
${d.List(
  d`${d.Input('field: { $lt: number }')} checks if value is less than`,
  d`${d.Input('field: { $lte: number }')} checks if value is less than or equal to`,
  d`${d.Input('field: { $gt: number }')} checks if value is greater than`,
  d`${d.Input('field: { $gte: number }')} checks if value is greater than or equal to`,
)}
${d.SubSection('Ordered Date Fields')}
${d.List(
  d`${d.Input('field: { $lt: Date | RelativeTime }')} checks if value is less than`,
  d`${d.Input('field: { $lte: Date | RelativeTime }')} checks if value is less than or equal to`,
  d`${d.Input('field: { $gt: Date | RelativeTime }')} checks if value is greater than`,
  d`${d.Input('field: { $gte: Date | RelativeTime }')} checks if value is greater than or equal to`,
)}

${d.Note('Relative times are strings consisting of a number and a unit.  e.g. -1w or 30d.  These times are always relative to Date.now, but should make building queries more natural.')}

${d.SubSection('Array Fields')}
${d.List(
  d`${d.Input('field: { $all: T[]] }')} checks to see if the records value contains everything within ${d.Input('$all')}`,
)}

${d.SubSection('String Fields')}
${d.List(
  d`${d.Input('field: { $regex: RegExp | string; }')} checks the field against the regular expression`,
)}

${d.SubSection('Geo Point Fields')}
${d.List(
  d`${d.Input('field: { $geoWithin: Point[] }')} determines if the value is within the bounding region of the points`,
  d`${d.Input(d`field: { $near: Point, $maxDistance: number, $unit: 'km' | 'm' | 'mi' | 'ft' }`)} searches at a point, and looks out radially`,
)}

${d.SubSection('Groupings')}
${d.List(
  d`${d.Input('{ $and: [] }')} provides a grouping in which all sub clauses are required`,
  d`${d.Input('{ $or: [] }')} provides a grouping in which at least one of the sub clauses is required`,
  d`${d.Input('{ $not: { } }')} negates a clause`,
)}

A sample query for ${d.Input('User')}'s might be:

${d.Code('Using the query structure for specific queries', 'doc/user-query.ts')}

This would find all users who are over ${d.Input('35')} and that have the ${d.Input('contact')} field specified.

${d.Section('Query Language')}

In addition to the standard query interface, the module also supports querying by query language to facilitate end-user queries.  This is meant to act as an interface that is simpler to write than the default object structure.

The language itself is fairly simple, boolean logic, with parenthetical support.  The operators supported are:
${d.List(
  d`${d.Input('<')}, ${d.Input('<=')} - Less than, and less than or equal to`,
  d`${d.Input('>')}, ${d.Input('>=')} - Greater than, and greater than or equal to`,
  d`${d.Input('!=')}, ${d.Input('==')} - Not equal to, and equal to`,
  d`${d.Input('~')} - Matches regular expression, supports the ${d.Input('i')} flag to trigger case insensitive searches`,
  d`${d.Input('!')}, ${d.Input('not')} - Negates a clause`,
  d`${d.Input('in')}, ${d.Input('not-in')} - Supports checking if a field is in a list of literal values`,
  d`${d.Input('and')}, ${d.Input('&&')} - Intersection of clauses`,
  d`${d.Input('or')}, ${d.Input('||')} - Union of clauses`,
)}

All sub fields are dot separated for access, e.g. ${d.Field('user.address.city')}. A query language version of the previous query could look like:

${d.Code('Query language with boolean checks and exists check', 'not (age < 35) and contact != null', false, 'sql')}

A more complex query would look like:

${d.Code('Query language with more complex needs',
  "user.role in ['admin', 'root'] && (user.address.state == 'VA' || user.address.city == 'Springfield')", false, 'sql')}

${d.SubSection('Regular Expression')}

When querying with regular expressions,patterns can be specified as ${d.Input('\'strings\'')} or as ${d.Input('/patterns/')}.  The latter allows for the case insensitive modifier: ${d.Input('/pattern/i')}.  Supporting the insensitive flag is up to the underlying model implementation.

${d.Section('Custom Model Query Service')}
In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for
repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the ${mod.ModelQuery} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

${d.Code('MongoDB Service Test Configuration', '@travetto/model-mongo/test/service.query.ts')}
`;