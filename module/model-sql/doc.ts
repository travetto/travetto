import { doc as d, Install, lib, mod, inp, List, Note, Header } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc-support';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { SQLModelConfig } from './src/config';
import { SQLModelService } from './src/service';

export const text = d`
${Header()}

${Install('Specific SQL Client: mysql', 'mysql')}

or 

${Install('Specific SQL Client: postgres', 'pg')}

This module provides a ${lib.SQL}-based implementation for the ${mod.Model} module.  This source allows the ${mod.Model} module to read, write and query against ${lib.SQL} databases. In development mode, the ${SQLModelService} will also modify the database schema in real time to minimize impact to development.

The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
a ${lib.SQL} database.  Every table generated will have a ${inp`path_id`} which determines it's location in the document hierarchy as well as sub tables will have a ${inp`parent_path_id`} to associate records with the parent values.

The current SQL client support stands at:
${List(
  d`${lib.MySQL} - 5.6 and 5.7`,
  d`${lib.Postgres} - 11+`,
  d`${inp`SQL Server`} - Currently unsupported`,
  d`${inp`Oracle`} - Currently unsupported`,
)}

${Note('Wider client support will roll out as usage increases.')}

Supported featrues:
${List(
  ...ModelTypes(SQLModelService),
  ...ModelQueryTypes(SQLModelService)
)}

${ModelCustomConfig(SQLModelConfig)}
`;