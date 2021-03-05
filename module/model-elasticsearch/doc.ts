import { doc as d, lib, mod, Section, Execute, List } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc-support';
import { Model } from '@travetto/model/src/registry/decorator';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { ElasticsearchModelConfig } from './src/config';
import { ElasticsearchModelService } from './src/service';

export const text = d`
This module provides an ${lib.Elasticsearch}-based implementation of the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Elasticsearch}. In development mode, ${ElasticsearchModelService} will also modify the ${lib.Elasticsearch} schema in real time to minimize impact to development.

Supported featrues:
${List(
  ...ModelTypes(ElasticsearchModelService),
  ...ModelQueryTypes(ElasticsearchModelService)
)}

${ModelCustomConfig(ElasticsearchModelConfig)}

${Section('CLI - model:es-schema')}

The module provides the ability to generate the full ${lib.Elasticsearch} schema from all the various ${Model}s within the application.  This is useful for being able to generate the appropriate ${lib.JSON} files to define your schemas in production.

${Execute('Running schema generate', 'trv', ['model:es-schema', '--help'])}
`;