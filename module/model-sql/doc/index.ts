import { d, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

${d.Install('Specific SQL Client: mysql', '@travetto/model-mysql')}

or 

${d.Install('Specific SQL Client: mysql', '@travetto/model-postgres')}

or 

${d.Install('Specific SQL Client: mysql', '@travetto/model-sqlite')}

The current SQL client support stands at:
${d.List(
  d`${lib.MySQL} - 5.6 and 5.7`,
  d`${lib.Postgres} - 11+`,
  d`${lib.SQLite} - (bettersqlite 7.6+)`,
  d`${d.Input('SQL Server')} - Currently unsupported`,
  d`${d.Input('Oracle')} - Currently unsupported`,
)}

${d.Note('Wider client support will roll out as usage increases.')}
`;