/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import type { ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport, ModelQuerySupport } from '@travetto/model-query';

import { Links } from './support/doc.support.ts';

export const text = <>
  <c.StdHeader />
  This module provides an enhanced query contract for {d.module('Model')} implementations.  This contract has been externalized due to it being more complex than many implementations can natively support.

  <c.Section title='Contracts'>
    <c.SubSection title='Query'>
      This contract provides the ability to apply the query support to return one or many items, as well as providing counts against a specific query.
      <c.Code title='Query' src={toConcrete<ModelQuerySupport>()} />
    </c.SubSection>
    <c.SubSection title='Crud'>
      Reinforcing the complexity provided in these contracts, the {Links.QueryCrud} contract allows for bulk update/deletion by query.  This requires the underlying implementation to support these operations.

      <c.Code title='Query Crud' src={toConcrete<ModelQueryCrudSupport>()} />
    </c.SubSection>

    <c.SubSection title='Facet'>
      With the complex nature of the query support, the ability to find counts by groups is a common and desirable pattern. This contract allows for faceting on a given field, with query filtering.

      <c.Code title='Query Facet' src={toConcrete<ModelQueryFacetSupport>()} />
    </c.SubSection>
    <c.SubSection title='Suggest'>
      Additionally, this same pattern avails it self in a set of suggestion methods that allow for powering auto completion and type-ahead functionalities.

      <c.Code title='Query Suggest' src={toConcrete<ModelQuerySuggestSupport>()} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Implementations'>
    <table>
      <thead>
        <tr>
          <td>Service</td><td>Query</td><td>QueryCrud</td><td>QueryFacet</td>
        </tr>
      </thead>
      <tbody>
        <tr><td>{d.module('ModelElasticsearch')}</td><td>X</td><td>X</td><td>X</td></tr>
        <tr><td>{d.module('ModelMongo')}</td><td>X'</td><td>X'</td><td>X'</td></tr>
        <tr><td>{d.module('ModelSql')}</td><td>X'</td><td>X'</td><td>X'</td></tr>
      </tbody>
    </table>
  </c.Section>
  <c.Section title='Querying'>

    One of the complexities of abstracting multiple storage mechanisms, is providing a consistent query language.  The query language the module uses is a derivation of {d.library('MongoDB')}'s query language, with some restrictions, additions, and caveats. Additionally, given the nature of typescript, all queries are statically typed, and will catch type errors at compile time.

    <c.SubSection title='General Fields'>
      <ul>
        <li>{d.input('field: { $eq: T }')} to determine if a field is equal to a value</li>
        <li>{d.input('field: { $ne: T }')} to determine if a field is not equal to a value</li>
        <li>{d.input('field: { $exists: boolean }')} to determine if a field exists or not, or for arrays, if its empty or not</li>
        <li>{d.input('field: T')} to see if the field is equal to whatever value is passed in`</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='General Single Valued Fields'>
      <ul>
        <li>{d.input('field: { $in: T[] }')} to see if a record's value appears in the array provided to {d.input('$in')}</li>
        <li>{d.input('field: { $nin: T[] }')} to see if a record's value does not appear in the array provided to {d.input('$in')}</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Ordered Numeric Fields'>
      <ul>
        <li>{d.input('field: { $lt: number }')} checks if value is less than</li>
        <li>{d.input('field: { $lte: number }')} checks if value is less than or equal to</li>
        <li>{d.input('field: { $gt: number }')} checks if value is greater than</li>
        <li>{d.input('field: { $gte: number }')} checks if value is greater than or equal to</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Ordered Date Fields'>
      <ul>
        <li>{d.input('field: { $lt: Date | RelativeTime }')} checks if value is less than</li>
        <li>{d.input('field: { $lte: Date | RelativeTime }')} checks if value is less than or equal to</li>
        <li>{d.input('field: { $gt: Date | RelativeTime }')} checks if value is greater than</li>
        <li>{d.input('field: { $gte: Date | RelativeTime }')} checks if value is greater than or equal to</li>
      </ul>

      <c.Note>Relative times are strings consisting of a number and a unit.  e.g. -1w or 30d.  These times are always relative to Date.now, but should make building queries more natural.</c.Note>
    </c.SubSection>
    <c.SubSection title='Array Fields'>
      <ul>
        <li>{d.input('field: { $all: T[]] }')} checks to see if the records value contains everything within {d.input('$all')}</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='String Fields'>
      <ul>
        <li>{d.input('field: { $regex: RegExp | string; }')} checks the field against the regular expression</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Geo Point Fields'>
      <ul>
        <li>{d.input('field: { $geoWithin: Point[] }')} determines if the value is within the bounding region of the points</li>
        <li>{d.input("field: { $near: Point, $maxDistance: number, $unit: 'km' | 'm' | 'mi' | 'ft' }")} searches at a point, and looks out radially</li>
      </ul>
    </c.SubSection>
    <c.SubSection title='Groupings'>
      <ul>
        <li>{d.input('{ $and: [] }')} provides a grouping in which all sub clauses are require,</li>
        <li>{d.input('{ $or: [] }')} provides a grouping in which at least one of the sub clauses is require,</li>
        <li>{d.input('{ $not: { } }')} negates a clause</li>
      </ul>

      A sample query for {d.input('User')}'s might be:

      <c.Code title='Using the query structure for specific queries' src='doc/user-query.ts' />

      This would find all users who are over {d.input('35')} and that have the {d.input('contact')} field specified.
    </c.SubSection>
  </c.Section>

  <c.Section title='Custom Model Query Service'>
    In addition to the provided contracts, the module also provides common utilities and shared test suites.The common utilities are useful for
    repetitive functionality, that is unable to be shared due to not relying upon inheritance(this was an intentional design decision).This allows for all the {d.module('ModelQuery')} implementations to completely own the functionality and also to be able to provide additional / unique functionality that goes beyond the interface.

    To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

    <c.Code title='MongoDB Service Test Configuration' src='doc/service.query.ts' />
  </c.Section>
</>;