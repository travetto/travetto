import { doc as d, lib, Mod, Code, Section, Execute } from '@travetto/doc';
import { ModelSource } from '@travetto/model/src/service/source';
import { ElasticsearchModelConfig } from './src/config';
import { Model } from '@travetto/model/src/registry/decorator';

export default d`
This module provides an ${lib.Elasticsearch}-based implementation of ${ModelSource} for the ${Mod('model')}.  This source allows the ${Mod('model')} module to read, write and query against ${lib.Elasticsearch}. In development mode, the ${ModelSource} will also modify the ${lib.Elasticsearch} schema in real time to minimize impact to development.

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the ${Mod('di')} module.

${Code('Wiring up a custom Model Source', 'alt/docs/src/source.ts')}

where the ${ElasticsearchModelConfig} is defined by:

${Code('Structure of ElasticsearchModelConfig', ElasticsearchModelConfig.ᚕfile)}

and can be overridden via environment variables or config files, as defined in ${Mod('config')}.

${Section('CLI - model:es-schema')}

The module provides the ability to generate the full ${lib.Elasticsearch} schema from all the various ${Model}s within the application.  This is useful for being able to generate the appropriate ${lib.JSON} files to define your schemas in production.

${Execute('Running schema generate', 'travetto', ['model:es-schema', '--help'])}
`;