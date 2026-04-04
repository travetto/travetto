/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import { Model, ModelRegistryIndex } from '@travetto/model';

import type { ModelIndexedSupport } from './src/types/service.ts';
import { IndexedFieldError } from './src/types/error.ts';
import { keyedIndex, sortedIndex, uniqueIndex } from './src/indexes.ts';

const ModelIndexedSupportContract = toConcrete<ModelIndexedSupport>();

export const text = <>
  <c.StdHeader />

  This module provides computed index support for data model sources that support it. It enables efficient lookups and list operations using composite keys extracted from model fields, without requiring a full query engine.

  <c.Section title='Overview'>
    The module allows you to define indexes on your models and use them for fast single-item lookups, uniqueness enforcement, and efficient paginated list operations. Indexes are computed from model field values and act as alternative keys for data access.

    <c.SubSection title='Index Types'>
      Three types of indexes are supported:

      <ul>
        <li><strong>Keyed Indexes</strong> — Fast single-item lookups using composite keys</li>
        <li><strong>Unique Indexes</strong> — Enforce uniqueness constraints on key fields</li>
        <li><strong>Sorted Indexes</strong> — Enable range queries and paginated listing with sorting</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='Defining Indexes'>
    Indexes are defined using factory functions provided by the module. Each index is registered with the model at decoration time.

    <c.SubSection title='Keyed Indexes'>
      A {keyedIndex} provides fast lookups by computed key values. It's useful when you want to query records by specific field combinations.

      <c.Code
        title='Creating a Keyed Index'
        src='doc/keyedIndex.ts'
      />

      The index definition specifies:
      <ul>
        <li> {d.field('name')} — The identifier for this index</li>
        <li> {d.field('key')} — An object where each key path should be included in the index (set to {d.input('true')})</li>
      </ul>


    </c.SubSection>

    <c.SubSection title='Unique Indexes'>
      A {uniqueIndex} enforces uniqueness constraints on key fields. This is useful for emails, usernames, or any field that should be globally unique.

      <c.Code
        title='Creating a Unique Index'
        src='doc/uniqueIndex.ts'
      />

      Unique indexes work exactly like keyed indexes, but enforce a uniqueness constraint. A model service will reject writes that violate the uniqueness guarantee.
    </c.SubSection>

    <c.SubSection title='Sorted Indexes'>
      A {sortedIndex} enables range queries and paginated listing. It requires both a {d.field('key')} for filtering and a {d.field('sort')} field for ordering.

      <c.Code
        title='Creating a Sorted Index'
        src='doc/sortedIndex.ts'
      />

      The {d.field('sort')} field must be numeric or a {d.class('Date')} type. The value {d.input('1')} means ascending order, {d.input('-1')} means descending.
    </c.SubSection>

    <c.SubSection title='Composite Keys'>
      Indexes can use multiple fields or nested fields in their keys. This allows querying by combinations of values.

      <c.Code
        title='Composite Key Index'
        src='doc/compositeKeys.ts'
      />
    </c.SubSection>
  </c.Section>

  <c.Section title='Using Indexes'>
    Model services that implement {ModelIndexedSupportContract} allow you to query using the indexes you've defined.

    <c.SubSection title='Service Interface'>
      <c.Code
        title='ModelIndexedSupport Interface'
        src={toConcrete<ModelIndexedSupport>()}
      />

      The service provides these operations:

      <ul>
        <li>{d.method('getByIndex')} — Fetch a single item by index</li>
        <li>{d.method('deleteByIndex')} — Delete a single item by index</li>
        <li>{d.method('upsertByIndex')} — Insert or update by index</li>
        <li>{d.method('updateByIndex')} — Update an existing item by index</li>
        <li>{d.method('updatePartialByIndex')} — Partially update an item by index</li>
        <li>{d.method('pageByIndex')} — Fetch a page of items with pagination metadata</li>
        <li>{d.method('listByIndex')} — Stream all matching items from a sorted index</li>
      </ul>
    </c.SubSection>

    <c.SubSection title='Getting Items'>
      Use {d.method('getByIndex')} to fetch a single item by providing all required key fields.

      <c.Code
        title='Getting by Keyed Index'
        src='doc/getByIndex.ts'
        startRe={/export async function getExample/}
      />

      For sorted indexes with key fields, you must provide all key values plus the sort value if using it to identify a specific item.

      All single-item index operations also accept an optional {d.field('id')} in the request body. This is useful when the index is not unique and you need to ensure the supplied index values resolve to the same record as the provided {d.field('id')}, such as enforcing a pattern like "userId matches".

      <c.Code
        title='Disambiguating with id'
        src='doc/getByIndex.ts'
        startRe={/export async function getScopedExample/}
      />
    </c.SubSection>

    <c.SubSection title='Deleting Items'>
      Use {d.method('deleteByIndex')} to remove an item by index.

      <c.Code
        title='Deleting by Index'
        src='doc/deleteByIndex.ts'
        startRe={/export async function deleteExample/}
      />

      As with {d.method('getByIndex')}, you can pass an optional {d.field('id')} to ensure the computed index values resolve to the expected record before deleting it.
    </c.SubSection>

    <c.SubSection title='Upserting Items'>
      Use {d.method('upsertByIndex')} to insert a new item or update an existing one. The index acts as a primary key.

      <c.Code
        title='Upserting by Index'
        src='doc/upsertByIndex.ts'
        startRe={/export async function upsertExample/}
      />
    </c.SubSection>

    <c.SubSection title='Updating Items'>
      Use {d.method('updateByIndex')} to update an existing item, or {d.method('updatePartialByIndex')} for partial updates.

      <c.Code
        title='Updating by Index'
        src='doc/updateByIndex.ts'
        startRe={/export async function/}
      />
    </c.SubSection>

    <c.SubSection title='Listing Items'>
      Use {d.method('pageByIndex')} when you want paginated access to a sorted index.

      <c.Code
        title='Paging by Sorted Index'
        src='doc/pageByIndex.ts'
        startRe={/export async function listExample/}
      />

      Use {d.method('listByIndex')} when you want to iterate through every matching item as an async stream.

      <c.Code
        title='Streaming by Sorted Index'
        src='doc/listByIndex.ts'
        startRe={/export async function listStreamExample/}
      />

      You can also provide key values to filter within a sorted index with {d.method('pageByIndex')}:

      <c.Code
        title='Listing with Key Filter'
        src='doc/pageByIndexWithFilter.ts'
        startRe={/export async function listWithFilterExample/}
      />
    </c.SubSection>
  </c.Section>

  <c.Section title='Integration'>
    Index registration happens automatically when models are decorated with {Model}. Model services like {d.module('ModelMemory')}, {d.module('ModelMongo')}, and {d.module('ModelSql')} implement the {ModelIndexedSupportContract} interface to provide indexed access.

    <c.SubSection title='Reading Registry Information'>
      You can access registered indexes via {ModelRegistryIndex} at runtime:

      <c.Code
        title='Accessing Model Indexes'
        src='doc/registryAccess.ts'
        startRe={/export function registryAccessExample/}
      />
    </c.SubSection>
  </c.Section>

  <c.Section title='Best Practices'>
    <ul>
      <li><strong>Plan indexes strategically</strong> — Define indexes for your common query patterns</li>
      <li><strong>Use composite keys</strong> — When filtering by multiple fields, include all of them in a single index</li>
      <li><strong>Leverage sorting</strong> — Use sorted indexes for paginated lists and range queries</li>
      <li><strong>Enforce uniqueness</strong> — Use {uniqueIndex} for fields that must be globally unique</li>
      <li><strong>Handle errors gracefully</strong> — Catch {IndexedFieldError} when working with user input</li>
    </ul>
  </c.Section>
</>;