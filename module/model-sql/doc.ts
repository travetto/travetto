import { doc as d, Install, lib, mod, inp, List, Note, Code, Section, Execute } from '@travetto/doc';
import { ModelSource } from '@travetto/model/src/service/source';
import { SQLModelConfig } from './src/config';
import { Model } from '@travetto/model/src/registry/decorator';

exports.text = d`
${Install('Specific SQL Client: mysql', 'mysql')}

or 

${Install('Specific SQL Client: postgres', 'pg')}

This module provides a ${lib.SQL}-based implementation of ${ModelSource} for the ${mod.Model} module.  This source allows the ${mod.Model} module to read, write and query against ${lib.SQL} databases. In development mode, the ${ModelSource} will also modify the database schema in real time to minimize impact to development.

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

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the ${mod.Di} module.

${Code('Wiring up a custom Model Source', 'doc/source.ts')}

where the ${SQLModelConfig} is defined by:

${Code('Structure of SQLModelConfig', SQLModelConfig.ᚕfile)}

and can be overridden via environment variables or config files, as defined in ${mod.Config}.

${Section('CLI - model:sql-schema')}

The module provides the ability to generate the full ${lib.SQL} schema from all the various ${Model}s within the application.  This is useful for being able to generate the appropriate ${lib.SQL} commands to define your schemas in production.

${Execute('Running schema generate', 'trv', ['model:sql-schema', '--help'])}
`;