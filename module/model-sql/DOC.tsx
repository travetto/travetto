/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

export const text = (
  <>
    <c.StdHeader />
    The current SQL client support stands at:
    <ul>
      <li>{d.module('ModelMysql')} - MySQL 8.0+</li>
      <li>{d.module('ModelPostgres')} - Postgres 14+</li>
      <li>{d.module('ModelSqlite')} - (Node Native SQLite)</li>
    </ul>
    <c.Note>Wider client support will roll out as usage increases.</c.Note>
    <c.Section title="Assumed Behavior">
      The {d.module('ModelSql')} works quite a bit different than the average {d.library('ORM')} in that it makes assertions about how data
      is stored in the database. The primary goal of the {d.library('SQL')} support is not to handle every scenario that a relational
      database can provide, but to integrate with the {d.module('Model')} structure, while leveraging relational datastores to the best of
      their abilities. <br />
      The primary design maps each model class to a single table where simple fields are mapped to individual columns, and complex fields
      (objects and arrays) are serialized and stored as native JSON document columns. Every table requires a primary key column, and indices
      are compiled directly to standard database columns or SQL functional expressions over JSON paths.
    </c.Section>
  </>
);
