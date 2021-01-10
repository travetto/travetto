import { doc as d, lib, mod, Code, Section, Execute } from '@travetto/doc';
import { ModelSource } from '@travetto/model/src/service/source';
import { ElasticsearchModelConfig } from './src/config';
import { Model } from '@travetto/model/src/registry/decorator';

exports.text = d`
This module provides an ${lib.Elasticsearch}-based implementation of ${ModelSource} for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Elasticsearch}. In development mode, the ${ModelSource} will also modify the ${lib.Elasticsearch} schema in real time to minimize impact to development.

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the ${mod.Di} module.

${Code('Wiring up a custom Model Source', 'doc/source.ts')}

where the ${ElasticsearchModelConfig} is defined by:

${Code('Structure of ElasticsearchModelConfig', ElasticsearchModelConfig.ᚕfile)}

and can be overridden via environment variables or config files, as defined in ${mod.Config}.

${Section('CLI - model:es-schema')}

The module provides the ability to generate the full ${lib.Elasticsearch} schema from all the various ${Model}s within the application.  This is useful for being able to generate the appropriate ${lib.JSON} files to define your schemas in production.

${Execute('Running schema generate', 'travetto', ['model:es-schema', '--help'])}
`;