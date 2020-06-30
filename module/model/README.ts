import { doc as d, Mod, Section, Code, inp, lib, List, SubSection, fld } from '@travetto/doc';
import { Model } from './src/registry/decorator';
import { ModelService } from './src/service/model';
import { ModelSource } from './src/service/source';
import { ModelController } from './src/extension/rest';


export default d`
This module provides a clean interface to data model persistence, modification and retrieval.  This module builds heavily upon the ${Mod('schema')}, which is used for data model validation.

The module can be segmented into three main areas: declaration, access/storage, and querying

${Section('Declaration')}
Models are declared via the ${Model} decorator, which allows the system to know that this is a class that is compatible with the module.

${Code('Extending BaseModel', 'alt/docs/src/user.ts')}

The ${inp`User`} model is now ready to be used with the model services.

${Section('Access/Storage')}
The ${ModelService} is the foundation for all access to the storage layer, and provides a comprehensive set of functionality.  The service includes support for modifying individual records, bulk update/insert/delete, partial updates, finding records, and more.  This should be the expected set of functionality for storage and retrieval.

${Code(d`Using ${ModelService.name} with the User model`, 'alt/docs/src/user-manager.ts')}

The ${ModelService} itself relies upon a ${ModelSource} which is the driver for the storage layer.

During development, ${ModelSource} supports the ability to respond to model changes in real-time, and to modify the underlying storage mechanism.  An example of this would be ${lib.Elasticsearch} schemas being updated as fields are added or removed from the ${Model} class.

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

${Code('Using the query structure for specific queries', 'alt/docs/src/user-query.ts')}

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

<!-- SUB -->

${Section('Extension - Rest')}

To facilitate common RESTful patterns, the module exposes  ${Mod('rest')} support in the form of ${ModelController}.


${Code('ModelController example', 'alt/docs/src/model-controller.ts')}

is a shorthand that is equal to:

${Code('Comparable UserController, built manually', 'alt/docs/src/controller.ts')}
  `;
