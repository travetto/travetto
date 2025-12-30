/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  The current SQL client support stands at:
  <ul>
    <li>{d.mod('ModelMysql')} - MySQL 8.6+</li>
    <li>{d.mod('ModelPostgres')} - Postgres 14+</li>
    <li>{d.mod('ModelSqlite')} - (bettersqlite 8.0+)</li>
    <li>{d.input('SQL Server')} - Currently unsupported</li>
    <li>{d.input('Oracle')} - Currently unsupported</li>
  </ul>

  <c.Note>Wider client support will roll out as usage increases.</c.Note>

  <c.Section title='Assumed Behavior'>

    The {d.mod('ModelSql')} works quite a bit different than the average {d.library('ORM')} in that it makes assertions about how data is stored in the database.  The primary goal of the {d.library('SQL')} support is not to handle every scenario that a relational database can provide, but to integrate with the {d.mod('Model')} structure, while leverage relational datastores to the best of their abilities. <br />

    The primary difference is around unique identifiers, and how parent/child relationships are managed.  In a normal database primary keys could be composite values between various fields.  For example a unique identifier could be a combination of {d.input('date')} + {d.input('orderNumber')} + {d.input('customerNumber')}.  This is perfectly normal in a relational model, but {d.mod('ModelSql')} assumes unique identifiers ({d.library('UUID')}) as 32-character hexadecimal values.  In addition to these unique values, the parent's identifier is required in all children values.  This allows for some fairly optimized querying, updates, and deletions on changes. <br />

    What this translates to, is that the framework here dictates the final schema, and doesn't support adapting to existing relational data stores. In greenfield projects, this is not an issue, but will most likely preclude its use in adapting to existing relational data sets.
  </c.Section>
</>;