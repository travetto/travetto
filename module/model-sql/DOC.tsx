/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { ModelTypes } from '@travetto/model/support/doc.support.ts';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';

import { Transactional } from './src/connection.ts';
import { BaseSQLModelService } from './src/service.ts';

export const text = (
  <>
    <c.StdHeader />
    This module provides the core SQL foundation for {d.module('Model')} datastores. The current SQL client implementations include:
    <ul>
      <li>{d.module('ModelMysql')} - MySQL 8.0+</li>
      <li>{d.module('ModelPostgres')} - Postgres 14+</li>
      <li>
        {d.module('ModelSqlite')} - SQLite (Node native {d.input('DatabaseSync')})
      </li>
    </ul>
    <c.Note>Wider client support will roll out as usage increases.</c.Note>
    <c.Section title="Assumed Behavior & Schema Design">
      The {d.module('ModelSql')} works quite a bit differently than the average {d.library('ORM')} in that it makes assertions about how
      data is stored in the database. The primary goal of the {d.library('SQL')} support is not to handle every legacy relational database
      scenario, but to integrate with the {d.module('Model')} structure while leveraging relational datastores to the best of their
      abilities. <br />
      The primary design maps each model class to a single table where simple fields (primitives, dates, enums) are mapped to individual
      columns, and complex fields (objects and arrays) are serialized and stored as native JSON document columns. Every table requires a
      primary key column ({d.field('id')}), and indices are compiled directly to standard database columns or SQL functional expressions
      over JSON paths.
      <br />
      In development mode, storage modifications are applied dynamically in real time to match model definitions, minimizing manual database
      migrations.
    </c.Section>
    <c.Section title="Transactions">
      Transaction state is tracked seamlessly using {d.module('Context')}. Methods can be wrapped using the {Transactional} decorator to run
      operations within a managed transaction.
      <br />
      Supported transaction modes include:
      <ul>
        <li>{d.field('required')} - Joins an active transaction if one exists, or starts a new top-level transaction.</li>
        <li>{d.field('isolated')} - Begins a savepoint / nested transaction isolated from the surrounding context.</li>
        <li>{d.field('force')} - Always creates a separate savepoint for nested operations.</li>
      </ul>
    </c.Section>
    <c.Section title="Bulk Operations">
      Bulk operations ({d.method('processBulk')}) batch insert, delete, and update statements for high performance. Bulk updates utilize
      standard ANSI SQL {d.input('CASE ... WHEN')} constructs to update multiple records in a single database query across all SQL engines.
    </c.Section>
    <c.Section title="Supported Features">
      All SQL model service implementations derive from {BaseSQLModelService} and support:
      <ul>
        {...ModelTypes(BaseSQLModelService)}
        {...ModelIndexedTypes(BaseSQLModelService)}
        {...ModelQueryTypes(BaseSQLModelService)}
      </ul>
    </c.Section>
  </>
);
