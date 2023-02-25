import { d, lib, mod } from '@travetto/doc';

export const text = () => d`
${d.Header()}

The current SQL client support stands at:
${d.List(
  d`${mod.ModelMysql} - MySQL 8.6+`,
  d`${mod.ModelPostgres} - Postgres 14+`,
  d`${mod.ModelSqlite} - (bettersqlite 8.0+)`,
  d`${d.Input('SQL Server')} - Currently unsupported`,
  d`${d.Input('Oracle')} - Currently unsupported`,
)}

${d.Note('Wider client support will roll out as usage increases.')}

${d.Section('Assumed Behavior')}

The ${mod.ModelSql} works quite a bit different than the average ${lib.ORM} in that it makes assertions about how data is stored in the database.  The primary goal of the ${lib.SQL} support is not to handle every scenario that a relational database can provide, but to integrate with the ${mod.Model} structure, while leverage relational datastores to the best of their abilities. 

The primary difference is around unique identifiers, and how parent/child relationships are managed.  In a normal database primary keys could be composite values between various fields.  For example a unique identifier could be a combination of ${d.Input('date')} + ${d.Input('orderNumber')} + ${d.Input('customerNumber')}.  This is perfectly normal in a relational model, but ${mod.ModelSql} assumes unique identifiers (${lib.UUID}) as 32-character hexadecimal values.  In addition to these unique values, the parent's identifier is required in all children values.  This allows for some fairly optimized querying, updates, and deletions on changes.  

What this translates to, is that the framework here dictates the final schema, and doesn't support adapting to existing relational data stores. In greenfield projects, this is not an issue, but will most likely preclude its use in adapting to existing relational data sets.
`;