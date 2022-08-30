import { d, lib, mod } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc-support';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

export const text = d`
${d.Header()}

This module provides a ${lib.MySQL}-based implementation for the ${mod.Model} module.  This source allows the ${mod.Model} module to read, write and query against ${lib.SQL} databases. In development mode, the ${SQLModelService} will also modify the database schema in real time to minimize impact to development.

The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
a ${lib.SQL} database.  Every table generated will have a ${d.Input('path_id')} which determines it's location in the document hierarchy as well as sub tables will have a ${d.Input('parent_path_id')} to associate records with the parent values.

Supported features:
${d.List(
  ...ModelTypes(SQLModelService),
  ...ModelQueryTypes(SQLModelService)
)}

${ModelCustomConfig(SQLModelConfig)}
`;