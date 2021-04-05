import { d, lib, mod } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc-support';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { ElasticsearchModelConfig } from './src/config';
import { ElasticsearchModelService } from './src/service';

export const text = d`
${d.Header()}

This module provides an ${lib.Elasticsearch}-based implementation of the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Elasticsearch}. In development mode, ${ElasticsearchModelService} will also modify the ${lib.Elasticsearch} schema in real time to minimize impact to development.

Supported featrues:
${d.List(
  ...ModelTypes(ElasticsearchModelService),
  ...ModelQueryTypes(ElasticsearchModelService)
)}

${ModelCustomConfig(ElasticsearchModelConfig)}
`;